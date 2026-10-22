// Creazione di un workout dal giorno del programma, recuperi e chiusura del workout.
import { buildMainSets, currentWeek, isDeloadWeek, nextPosition, proposeTm } from './program531'
import type { Day, Exercise, Lift, LiftPosition, PlannedExercise, Session, SessionExercise, SessionSet, Settings } from './types'

export interface BuildContext {
  exercises: Map<string, Exercise>
  lifts: Map<string, Lift>
  settings: Settings
  /** Set di lavoro dell'ultima sessione completata, per esercizio. */
  lastSets: Map<string, SessionSet[]>
}

const WARMUP_REST = 60

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Microciclo di scarico: un esercizio principale del programma è nella sua settimana di scarico. */
export function isDeloadMicrocycle(lifts: Iterable<Lift>): boolean {
  for (const lift of lifts) if (isDeloadWeek(currentWeek(lift))) return true
  return false
}

export function buildSessionExercise(pe: PlannedExercise, ctx: BuildContext, deload: boolean): SessionExercise {
  const exercise = ctx.exercises.get(pe.exerciseId)
  const lift = ctx.lifts.get(pe.exerciseId)
  const base = {
    key: newId(),
    exerciseId: pe.exerciseId,
    notes: '',
    superset: pe.superset ?? null,
  }
  if (pe.role === 'main531' && lift) {
    const week = currentWeek(lift)
    return {
      ...base,
      role: 'main531',
      week,
      cycle: lift.position.cycle,
      tm: lift.tm,
      restSec: lift.rest.work,
      sets: buildMainSets(lift, ctx.settings, week),
    }
  }
  // Complementare: peso dell'ultima volta se c'è, altrimenti quello pianificato.
  let count = pe.sets ?? 3
  if (deload) count = Math.max(1, Math.ceil(count / 2))
  const last = ctx.lastSets.get(pe.exerciseId)?.find((s) => s.type !== 'warmup' && s.weight !== null)
  const weight = last?.weight ?? pe.weight ?? null
  const reps = pe.reps ?? pe.repMax ?? null
  const sets: SessionSet[] = Array.from({ length: count }, () => ({
    type: 'normal',
    weight,
    targetReps: reps,
    reps: null,
    rpe: null,
    done: false,
  }))
  return {
    ...base,
    role: 'accessory',
    restSec: pe.restSec ?? exercise?.restSec ?? ctx.settings.restAccessory,
    sets,
  }
}

export function buildSession(day: Day, ctx: BuildContext, now = Date.now()): Session {
  const deload = isDeloadMicrocycle(ctx.lifts.values())
  return {
    id: newId(),
    dayId: day.id,
    dayName: day.name,
    startedAt: now,
    endedAt: null,
    status: 'active',
    notes: '',
    microcycle: ctx.settings.microcycle,
    deload,
    exercises: day.exercises.map((pe) => buildSessionExercise(pe, ctx, deload)),
  }
}

/**
 * Secondi di recupero dopo aver spuntato il set `setIdx` dell'esercizio `exIdx`.
 * 0 = nessun timer (superset: si passa subito all'altro esercizio).
 */
export function restAfterSet(session: Session, exIdx: number, setIdx: number, lift?: Lift): number {
  const ex = session.exercises[exIdx]
  const set = ex.sets[setIdx]

  if (ex.superset) {
    const group = session.exercises.filter((e) => e.superset === ex.superset)
    const pos = group.indexOf(ex)
    const partnerPending = group.slice(pos + 1).some((e) => e.sets.some((s) => !s.done))
    if (pos < group.length - 1 && partnerPending) return 0
  }

  if (ex.role !== 'main531' || !lift) return ex.restSec
  if (set.type === 'warmup') return WARMUP_REST
  if (set.type === 'plus') return lift.rest.afterPlus
  if (set.type === 'fsl') {
    const missed = set.reps !== null && set.targetReps !== null && set.reps < set.targetReps
    return missed ? lift.rest.fslMissed : lift.rest.fsl
  }
  if (ex.sets[setIdx + 1]?.type === 'plus') return lift.rest.beforePlus
  return lift.rest.work
}

/** Reps contate per un set (se spuntato senza modifiche vale il target). */
export const repsDone = (s: SessionSet) => (s.done ? (s.reps ?? s.targetReps ?? 0) : 0)

export interface FinishEffects {
  lifts: { exerciseId: string; position: LiftPosition; pendingTm: Lift['pendingTm'] }[]
  nextDayIdx: number
  microcycle: number
}

/** Cosa cambia quando chiudi un workout: avanzamento dei principali e prossimo giorno. */
export function finishEffects(session: Session, ctx: BuildContext, dayIds: string[]): FinishEffects {
  const lifts: FinishEffects['lifts'] = []
  for (const ex of session.exercises) {
    if (ex.role !== 'main531') continue
    const lift = ctx.lifts.get(ex.exerciseId)
    const exercise = ctx.exercises.get(ex.exerciseId)
    if (!lift || !exercise) continue
    const worked = ex.sets.some((s) => s.done && s.type !== 'warmup' && s.type !== 'fsl')
    if (!worked) continue
    let pendingTm = lift.pendingTm ?? null
    if (ex.week === 'S3') {
      const plus = ex.sets.find((s) => s.type === 'plus')
      const reps = plus?.done ? repsDone(plus) : null
      const p = proposeTm(lift, exercise, ctx.settings, reps)
      pendingTm = { proposed: p.proposed, reason: p.reason }
    }
    lifts.push({ exerciseId: ex.exerciseId, position: nextPosition(lift), pendingTm })
  }

  let { nextDayIdx, microcycle } = ctx.settings
  const idx = session.dayId ? dayIds.indexOf(session.dayId) : -1
  if (idx >= 0 && dayIds.length > 0) {
    nextDayIdx = idx + 1
    if (nextDayIdx >= dayIds.length) {
      nextDayIdx = 0
      microcycle += 1
    }
  }
  return { lifts, nextDayIdx, microcycle }
}
