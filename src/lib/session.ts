// Un giorno del programma: cosa fare in una settimana, chiusura con "Fatto" e avanzamento della settimana.
import { buildMainSets, currentWeek, isDeloadWeek, nextPosition, proposeTm, slotKey } from './program531'
import type { Day, Exercise, Lift, PlannedExercise, Position, Session, SessionExercise, SessionSet, Settings, WeekKind } from './types'

export interface BuildContext {
  exercises: Map<string, Exercise>
  lifts: Map<string, Lift>
  settings: Settings
  /** Set dell'ultima sessione completata, per esercizio e ruolo (vedi lastKey). */
  lastSets: Map<string, SessionSet[]>
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** "Ultima volta" separata per ruolo: la panca 5/3/1 e la panca 4×8 di un altro giorno non si mescolano. */
export const lastKey = (exerciseId: string, role: SessionExercise['role']) => `${role}:${exerciseId}`

/** Reps contate per un set (se spuntato senza modifiche vale il target). */
export const repsDone = (s: SessionSet) => (s.done ? (s.reps ?? s.targetReps ?? 0) : 0)

export function buildSessionExercise(pe: PlannedExercise, ctx: BuildContext, kind: WeekKind, cycle: number): SessionExercise {
  const exercise = ctx.exercises.get(pe.exerciseId)
  const lift = ctx.lifts.get(pe.exerciseId)
  const base = { key: newId(), exerciseId: pe.exerciseId, notes: '', superset: pe.superset ?? null }
  if (pe.role === 'main531' && lift) {
    return { ...base, role: 'main531', week: kind, cycle, tm: lift.tm, restSec: lift.rest.work, sets: buildMainSets(lift, ctx.settings, kind) }
  }
  // Complementare: peso dell'ultima volta se c'è, altrimenti quello pianificato. Nello scarico metà set.
  let count = pe.sets ?? 3
  if (isDeloadWeek(kind)) count = Math.max(1, Math.ceil(count / 2))
  const last = ctx.lastSets.get(lastKey(pe.exerciseId, 'accessory'))?.find((s) => s.type !== 'warmup' && s.weight !== null)
  const weight = last?.weight ?? pe.weight ?? null
  const reps = pe.reps ?? pe.repMax ?? null
  const sets: SessionSet[] = Array.from({ length: count }, () => ({ type: 'normal', weight, targetReps: reps, reps: null, rpe: null, done: false }))
  return { ...base, role: 'accessory', restSec: pe.restSec ?? exercise?.restSec ?? ctx.settings.restAccessory, sets }
}

/** Cosa c'è da fare in un giorno, nella settimana `pos`. */
export function planDay(day: Day, ctx: BuildContext, pos: Position): SessionExercise[] {
  const kind = currentWeek(ctx.settings.cycleConfig, pos)
  return day.exercises.map((pe) => buildSessionExercise(pe, ctx, kind, pos.cycle))
}

/** Set "+" del giorno (uno per esercizio principale): servono le reps per il nuovo TM. */
export function plusSets(plan: SessionExercise[]): { exerciseId: string; weight: number | null; target: number }[] {
  const out: { exerciseId: string; weight: number | null; target: number }[] = []
  for (const ex of plan) {
    const plus = ex.role === 'main531' ? ex.sets.find((s) => s.type === 'plus') : undefined
    if (plus && !out.some((o) => o.exerciseId === ex.exerciseId)) {
      out.push({ exerciseId: ex.exerciseId, weight: plus.weight, target: plus.targetReps ?? 0 })
    }
  }
  return out
}

/** Il giorno fatto: tutti i set come pianificati, il set "+" con le reps indicate. */
export function completeDay(day: Day, ctx: BuildContext, pos: Position, plusReps: Map<string, number>, now = Date.now()): Session {
  const kind = currentWeek(ctx.settings.cycleConfig, pos)
  const exercises = planDay(day, ctx, pos).map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({
      ...s,
      done: true,
      reps: s.type === 'plus' && plusReps.has(ex.exerciseId) ? plusReps.get(ex.exerciseId)! : s.targetReps,
    })),
  }))
  return {
    id: newId(),
    dayId: day.id,
    dayName: day.name,
    slot: slotKey(pos),
    cycle: pos.cycle,
    week: kind,
    startedAt: now,
    endedAt: now,
    status: 'done',
    notes: '',
    deload: isDeloadWeek(kind),
    exercises,
  }
}

export interface WeekEffects {
  position: Position
  pendingTm: { exerciseId: string; pendingTm: Lift['pendingTm'] }[]
}

/**
 * Dopo un "Fatto": se tutti i giorni della settimana sono fatti, si passa alla settimana dopo.
 * Finita la S3, per ogni principale si propone il nuovo TM (in base al suo set "+").
 */
export function afterDayDone(days: Day[], doneInSlot: Session[], ctx: BuildContext, pos: Position): WeekEffects | null {
  const doneIds = new Set(doneInSlot.map((s) => s.dayId))
  if (days.length === 0 || !days.every((d) => doneIds.has(d.id))) return null
  const cfg = ctx.settings.cycleConfig
  const pendingTm: WeekEffects['pendingTm'] = []
  if (currentWeek(cfg, pos) === 'S3') {
    for (const lift of ctx.lifts.values()) {
      const exercise = ctx.exercises.get(lift.exerciseId)
      if (!exercise) continue
      const ex = doneInSlot.flatMap((s) => s.exercises).find((e) => e.role === 'main531' && e.exerciseId === lift.exerciseId)
      if (!ex) continue
      const plus = ex.sets.find((s) => s.type === 'plus')
      const p = proposeTm(lift, exercise, ctx.settings, plus ? repsDone(plus) : null)
      pendingTm.push({ exerciseId: lift.exerciseId, pendingTm: { proposed: p.proposed, reason: p.reason } })
    }
  }
  return { position: nextPosition(cfg, pos), pendingTm }
}
