// Motore 5/3/1: settimane del ciclo, set pianificati, avanzamento e proposta del nuovo TM.
import type { Exercise, Lift, LiftPosition, SessionSet, SetType, Settings, WeekKind } from './types'
import { roundWeight } from './weights'

interface PlannedPct {
  pct: number
  reps: number
  repsMax?: number
  type: SetType
}

const w = (pct: number, reps: number, type: SetType = 'normal', repsMax?: number): PlannedPct => ({
  pct,
  reps,
  type,
  repsMax,
})

/** Percentuali del TM per ogni settimana. */
export const WEEK_SETS: Record<WeekKind, PlannedPct[]> = {
  S1: [w(0.65, 5), w(0.75, 5), w(0.85, 5, 'plus')],
  S2: [w(0.7, 3), w(0.8, 3), w(0.9, 3, 'plus')],
  S3: [w(0.75, 5), w(0.85, 3), w(0.95, 1, 'plus')],
  DELOAD: [w(0.4, 5), w(0.5, 5), w(0.6, 5)],
  SEVENTH_DELOAD: [w(0.7, 5), w(0.8, 3, 'normal', 5), w(0.9, 1), w(1, 1)],
  SEVENTH_TEST: [w(0.7, 5), w(0.8, 5), w(0.9, 5), w(1, 5)],
}

export const WEEK_LABEL: Record<WeekKind, string> = {
  S1: 'S1',
  S2: 'S2',
  S3: 'S3',
  DELOAD: 'Scarico',
  SEVENTH_DELOAD: '7ª settimana (scarico)',
  SEVENTH_TEST: '7ª settimana (test del TM)',
}

export const isDeloadWeek = (kind: WeekKind) => kind === 'DELOAD' || kind === 'SEVENTH_DELOAD'

/** Settimane del ciclo `cycle` (1, 2, 3...) per questo esercizio. */
export function weeksOfCycle(lift: Lift, cycle: number): WeekKind[] {
  const base: WeekKind[] = ['S1', 'S2', 'S3']
  if (lift.template === 'forever') {
    const block = Math.max(1, lift.leaderCycles) + Math.max(0, lift.anchorCycles)
    const k = ((cycle - 1) % block) + 1
    const seventh: WeekKind = lift.seventhWeek === 'tmtest' ? 'SEVENTH_TEST' : 'SEVENTH_DELOAD'
    const endsPhase = k === Math.max(1, lift.leaderCycles) || k === block
    return endsPhase ? [...base, seventh] : base
  }
  const every = Math.max(1, Math.round(lift.deloadEvery))
  return cycle % every === 0 ? [...base, 'DELOAD'] : base
}

/** Fase di 5/3/1 Forever del ciclo, oppure null per il 5/3/1 originale. */
export function foreverPhase(lift: Lift, cycle: number): 'Leader' | 'Anchor' | null {
  if (lift.template !== 'forever') return null
  const block = Math.max(1, lift.leaderCycles) + Math.max(0, lift.anchorCycles)
  const k = ((cycle - 1) % block) + 1
  return k <= Math.max(1, lift.leaderCycles) ? 'Leader' : 'Anchor'
}

/** La settimana da fare adesso. */
export function currentWeek(lift: Lift): WeekKind {
  if (lift.position.extra) return lift.position.extra
  const weeks = weeksOfCycle(lift, lift.position.cycle)
  return weeks[Math.min(lift.position.weekIdx, weeks.length - 1)]
}

/** Es. "Ciclo 1 · S3", "Ciclo 2 (Leader) · S1", "Ciclo 1 · S2 extra". */
export function positionLabel(lift: Lift): string {
  const phase = foreverPhase(lift, lift.position.cycle)
  const cycle = `Ciclo ${lift.position.cycle}${phase ? ` (${phase})` : ''}`
  const week = WEEK_LABEL[currentWeek(lift)]
  return `${cycle} · ${week}${lift.position.extra ? ' extra' : ''}`
}

/** Posizione dopo aver completato (o saltato) la settimana corrente. */
export function nextPosition(lift: Lift): LiftPosition {
  const { cycle, weekIdx, extra } = lift.position
  if (extra) return { cycle, weekIdx, extra: null }
  const weeks = weeksOfCycle(lift, cycle)
  if (weekIdx + 1 < weeks.length) return { cycle, weekIdx: weekIdx + 1, extra: null }
  return { cycle: cycle + 1, weekIdx: 0, extra: null }
}

/** Posizione precedente nella sequenza (null se siamo all'inizio). */
function previousWeek(lift: Lift): WeekKind | null {
  const { cycle, weekIdx } = lift.position
  if (weekIdx > 0) return weeksOfCycle(lift, cycle)[weekIdx - 1]
  if (cycle > 1) {
    const prev = weeksOfCycle(lift, cycle - 1)
    return prev[prev.length - 1]
  }
  return null
}

/** Comandi della schermata Programma per riallineare gli esercizi. */
export function repeatLastWeek(lift: Lift): LiftPosition {
  const prev = previousWeek(lift)
  return prev ? { ...lift.position, extra: prev } : lift.position
}

export function insertExtraWeek(lift: Lift, kind: WeekKind): LiftPosition {
  return { ...lift.position, extra: kind }
}

export function skipWeek(lift: Lift): LiftPosition {
  return nextPosition(lift)
}

/** Set pianificati (riscaldamento, lavoro, FSL) per la settimana corrente. */
export function buildMainSets(lift: Lift, settings: Settings, kind: WeekKind = currentWeek(lift)): SessionSet[] {
  const round = (pct: number) => roundWeight(lift.tm * pct, settings.roundingStep, settings.roundingMode)
  const sets: SessionSet[] = []
  const work = WEEK_SETS[kind]

  // Niente riscaldamento a parte nello scarico: i set sono già leggeri.
  if (kind !== 'DELOAD') {
    const firstPct = work[0].pct
    for (const wu of settings.warmup) {
      if (wu.pct >= firstPct) continue
      sets.push(plannedSet('warmup', round(wu.pct), wu.reps, wu.pct))
    }
  }
  for (const p of work) {
    const s = plannedSet(p.type, round(p.pct), p.reps, p.pct)
    if (p.repsMax) s.targetRepsMax = p.repsMax
    sets.push(s)
  }
  const fsl = kind === 'S1' || kind === 'S2' || kind === 'S3' ? lift.fsl[kind] : undefined
  if (fsl && fsl.sets > 0) {
    for (let i = 0; i < fsl.sets; i++) sets.push(plannedSet('fsl', round(work[0].pct), fsl.reps, work[0].pct))
  }
  return sets
}

function plannedSet(type: SetType, weight: number, reps: number, pct?: number): SessionSet {
  return { type, weight, targetReps: reps, reps: null, rpe: null, done: false, pct }
}

/** Proposta del nuovo TM a fine ciclo, in base alle reps del set "+" della S3. */
export function proposeTm(
  lift: Lift,
  exercise: Pick<Exercise, 'bodyPart'>,
  settings: Pick<Settings, 'upperIncrement' | 'lowerIncrement' | 'roundingStep' | 'roundingMode'>,
  plusReps: number | null,
): { proposed: number; increment: number; reason: string } {
  if (plusReps === null) {
    return { proposed: lift.tm, increment: 0, reason: 'Set "+" della S3 non registrato: TM invariato.' }
  }
  const defaultInc = exercise.bodyPart === 'lower' ? settings.lowerIncrement : settings.upperIncrement
  const target = WEEK_SETS.S3.find((s) => s.type === 'plus')!.reps
  const rules = lift.tmRules.length ? [...lift.tmRules] : [{ minReps: target, increment: defaultInc }]
  rules.sort((a, b) => b.minReps - a.minReps)
  const rule = rules.find((r) => plusReps >= r.minReps)
  const increment = rule?.increment ?? 0
  const proposed = roundWeight(lift.tm + increment, settings.roundingStep, settings.roundingMode)
  const reps = `${plusReps} rep${plusReps === 1 ? '' : 's'}`
  let reason: string
  if (increment > 0) reason = `Set "+" della S3: ${reps} → +${fmt(increment)} kg.`
  else if (plusReps < target) reason = `Set "+" della S3 sotto l'obiettivo (${reps}): meglio non aumentare.`
  else reason = `Set "+" della S3: ${reps} → TM invariato.`
  return { proposed, increment, reason }
}

const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 })
