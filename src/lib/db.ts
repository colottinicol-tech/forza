// Database sul telefono (IndexedDB tramite Dexie) e operazioni che toccano più tabelle.
import Dexie, { type Table } from 'dexie'
import { DEFAULT_SETTINGS } from './defaults'
import { nextPosition, slotKey } from './program531'
import { afterDayDone, finalizeDraft, lastKey, missingPlusReps, newDraft, type BuildContext } from './session'
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

/** Il giorno della settimana attuale già iniziato o fatto (se c'è). */
async function entryFor(dayId: string, slot: string): Promise<Session | undefined> {
  return (await db.sessions.where('slot').equals(slot).toArray()).find((s) => s.dayId === dayId)
}

/** Crea (se serve) il giorno in corso nella settimana attuale e ne restituisce l'id. */
export async function ensureDraft(day: Day): Promise<string> {
  const ctx = await buildContext()
  const pos = ctx.settings.position
  return db.transaction('rw', db.sessions, async () => {
    const existing = await entryFor(day.id, slotKey(pos))
    if (existing) return existing.id
    const draft = newDraft(day, ctx, pos)
    await db.sessions.add(draft)
    return draft.id
  })
}

/** Modifica un giorno leggendo sempre l'ultima versione salvata (tocchi rapidi non si perdono). */
export async function editSession(id: string, fn: (s: Session) => void): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    fn(s)
    await db.sessions.put(s)
  })
}

/**
 * "Fatto": chiude il giorno nella settimana attuale; se la settimana è completa passa alla successiva.
 * Restituisce 'missing-plus' se manca ancora qualche reps del set "+".
 */
export async function markDayDone(day: Day): Promise<'ok' | 'missing-plus'> {
  const ctx = await buildContext()
  const days = await orderedDays()
  const pos = ctx.settings.position
  const inSlot = await db.sessions.where('slot').equals(slotKey(pos)).toArray()
  const existing = inSlot.find((s) => s.dayId === day.id)
  if (existing?.status === 'done') return 'ok'
  const draft = existing ?? newDraft(day, ctx, pos)
  if (missingPlusReps(draft).length) return 'missing-plus'
  const session = finalizeDraft(draft)
  const doneInSlot = inSlot.filter((s) => s.status === 'done' && s.id !== session.id)
  const fx = afterDayDone(days, [...doneInSlot, session], ctx, pos)

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
  return 'ok'
}

/** Il giorno torna "da finire", con le reps già scritte. */
const reopen = (session: Session): Session => ({ ...session, status: 'active', endedAt: null, undo: null })

/**
 * Toglie la spunta a un giorno. Si può solo nella settimana attuale, oppure per l'ultimo giorno che ha fatto
 * avanzare la settimana (finché nella nuova settimana non è stato fatto niente). Restituisce false se non si può.
 */
export async function unmarkDay(session: Session): Promise<boolean> {
  const settings = await getSettings()
  const pos = settings.position
  if (session.slot === slotKey(pos)) {
    await db.sessions.put(reopen(session))
    return true
  }
  const undo = session.undo
  if (!undo) return false
  const advancedTo = nextPosition(settings.cycleConfig, undo.position)
  if (slotKey(advancedTo) !== slotKey(pos)) return false
  const inNewWeek = await db.sessions.where('slot').equals(slotKey(pos)).toArray()
  if (inNewWeek.some((s) => s.status === 'done')) return false
  await db.transaction('rw', [db.sessions, db.lifts, db.settings], async () => {
    for (const p of undo.pendingTm) {
      const lift = await db.lifts.get(p.exerciseId)
      if (lift) await db.lifts.put({ ...lift, pendingTm: p.pendingTm })
    }
    await db.settings.put({ ...settings, position: undo.position })
    // Giorni appena aperti nella nuova settimana: si buttano, la settimana torna indietro.
    for (const s of inNewWeek) await db.sessions.delete(s.id)
    await db.sessions.put(reopen(session))
  })
  return true
}
