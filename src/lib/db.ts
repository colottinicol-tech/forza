// Database sul telefono (IndexedDB tramite Dexie) e operazioni che toccano più tabelle.
import Dexie, { type Table } from 'dexie'
import { DEFAULT_SETTINGS } from './defaults'
import { finishEffects, lastKey, type BuildContext } from './session'
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
export function lastSetsByExercise(done: Session[], excludeId?: string): Map<string, SessionSet[]> {
  const map = new Map<string, SessionSet[]>()
  for (const s of done) {
    if (s.id === excludeId) continue
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

/** Chiude il workout: lo salva come completato, fa avanzare i principali e il giorno. */
export async function finishSession(session: Session, sessionRpe: number | null): Promise<void> {
  const ctx = await buildContext()
  const days = await orderedDays()
  const fx = finishEffects(session, ctx, days.map((d) => d.id))
  await db.transaction('rw', [db.sessions, db.lifts, db.settings], async () => {
    await db.sessions.put({ ...session, status: 'done', endedAt: Date.now(), sessionRpe })
    for (const u of fx.lifts) {
      const lift = ctx.lifts.get(u.exerciseId)!
      await db.lifts.put({ ...lift, position: u.position, pendingTm: u.pendingTm })
    }
    await db.settings.put({ ...ctx.settings, nextDayIdx: fx.nextDayIdx, microcycle: fx.microcycle, timer: null })
  })
}
