// Database sul telefono (IndexedDB tramite Dexie) e operazioni che toccano più tabelle.
import Dexie, { type Table } from 'dexie'
import { DEFAULT_SETTINGS } from './defaults'
import { nextPosition, slotKey } from './program531'
import { afterDayDone, completeDay, lastKey, type BuildContext } from './session'
import type { BodyWeight, Day, Exercise, Lift, Session, SessionSet, Settings, TmChange } from './types'

class ForzaDB extends Dexie {
  settings!: Table<Settings, string>
  exercises!: Table<Exercise, string>
  lifts!: Table<Lift, string>
  tmHistory!: Table<TmChange, number>
  days!: Table<Day, string>
  sessions!: Table<Session, string>
  bodyweight!: Table<BodyWeight, number>

  constructor() {
    super('forza')
    this.version(1).stores({
      settings: 'id',
      exercises: 'id, name',
      lifts: 'exerciseId',
      tmHistory: '++id, exerciseId, date',
      days: 'id, order',
      sessions: 'id, status, startedAt, dayId',
      bodyweight: '++id, date',
    })
    this.version(2).stores({ sessions: 'id, status, startedAt, dayId, slot' })
  }
}

export const db = new ForzaDB()

export const TABLES = ['settings', 'exercises', 'lifts', 'tmHistory', 'days', 'sessions', 'bodyweight'] as const

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main')
  return { ...DEFAULT_SETTINGS, ...s }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'main' })
}

export async function orderedDays(): Promise<Day[]> {
  return db.days.orderBy('order').toArray()
}

/** Sessioni completate, dalla più recente. */
export async function doneSessions(): Promise<Session[]> {
  const all = await db.sessions.orderBy('startedAt').reverse().toArray()
  return all.filter((s) => s.status === 'done')
}

/** Set dell'ultima sessione completata per ogni esercizio e ruolo. */
export function lastSetsByExercise(done: Session[]): Map<string, SessionSet[]> {
  const map = new Map<string, SessionSet[]>()
  for (const s of done) {
    for (const ex of s.exercises) {
      const key = lastKey(ex.exerciseId, ex.role)
      if (!map.has(key)) map.set(key, ex.sets.filter((x) => x.type !== 'warmup'))
    }
  }
  return map
}

export async function buildContext(): Promise<BuildContext> {
  const [settings, exercises, lifts, done] = await Promise.all([
    getSettings(),
    db.exercises.toArray(),
    db.lifts.toArray(),
    doneSessions(),
  ])
  return {
    settings,
    exercises: new Map(exercises.map((e) => [e.id, e])),
    lifts: new Map(lifts.map((l) => [l.exerciseId, l])),
    lastSets: lastSetsByExercise(done),
  }
}

export async function setTm(exerciseId: string, tm: number, reason: string): Promise<void> {
  await db.transaction('rw', db.lifts, db.tmHistory, async () => {
    const lift = await db.lifts.get(exerciseId)
    if (!lift) return
    await db.lifts.put({ ...lift, tm, pendingTm: null })
    await db.tmHistory.add({ exerciseId, date: Date.now(), tm, reason })
  })
}

/** "Fatto": salva il giorno nella settimana attuale; se la settimana è completa passa alla successiva. */
export async function markDayDone(day: Day, plusReps: Map<string, number>): Promise<void> {
  const ctx = await buildContext()
  const days = await orderedDays()
  const pos = ctx.settings.position
  const inSlot = await db.sessions.where('slot').equals(slotKey(pos)).toArray()
  if (inSlot.some((s) => s.dayId === day.id)) return
  const session = completeDay(day, ctx, pos, plusReps)
  const fx = afterDayDone(days, [...inSlot, session], ctx, pos)

  await db.transaction('rw', [db.sessions, db.lifts, db.settings], async () => {
    if (fx) {
      session.undo = {
        position: pos,
        pendingTm: fx.pendingTm.map((p) => ({ exerciseId: p.exerciseId, pendingTm: ctx.lifts.get(p.exerciseId)?.pendingTm ?? null })),
      }
      for (const p of fx.pendingTm) {
        const lift = ctx.lifts.get(p.exerciseId)
        if (lift) await db.lifts.put({ ...lift, pendingTm: p.pendingTm })
      }
      await db.settings.put({ ...ctx.settings, position: fx.position })
    }
    await db.sessions.put(session)
  })
}

/**
 * Toglie la spunta a un giorno. Si può solo nella settimana attuale, oppure per l'ultimo giorno che ha fatto
 * avanzare la settimana (finché nella nuova settimana non è stato fatto niente). Restituisce false se non si può.
 */
export async function unmarkDay(session: Session): Promise<boolean> {
  const settings = await getSettings()
  const pos = settings.position
  if (session.slot === slotKey(pos)) {
    await db.sessions.delete(session.id)
    return true
  }
  const undo = session.undo
  if (!undo) return false
  const advancedTo = nextPosition(settings.cycleConfig, undo.position)
  if (slotKey(advancedTo) !== slotKey(pos)) return false
  if ((await db.sessions.where('slot').equals(slotKey(pos)).count()) > 0) return false
  await db.transaction('rw', [db.sessions, db.lifts, db.settings], async () => {
    for (const p of undo.pendingTm) {
      const lift = await db.lifts.get(p.exerciseId)
      if (lift) await db.lifts.put({ ...lift, pendingTm: p.pendingTm })
    }
    await db.settings.put({ ...settings, position: undo.position })
    await db.sessions.delete(session.id)
  })
  return true
}
