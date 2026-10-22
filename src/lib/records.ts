// Record personali: e1RM migliore e reps migliori a parità di peso.
import { repsDone } from './session'
import type { LoadType, Session, SessionSet } from './types'
import { e1rm } from './weights'

export interface RecordOptions {
  plusRepsBonus: number
  loadTypes: Map<string, LoadType>
  /** Peso corporeo da sommare alla zavorra (esercizi "weighted"). */
  bodyweight: number | null
}

export interface Bests {
  e1rm: number
  repsAtWeight: Map<number, number>
}

export interface RecordHit {
  exerciseId: string
  kind: 'e1rm' | 'reps'
  weight: number
  reps: number
  value: number
  previous: number
}

const countsForRecords = (s: SessionSet) => s.done && s.type !== 'warmup' && s.weight !== null && repsDone(s) > 0

/** e1RM di un set (0 se non conta: riscaldamento, non fatto, esercizio assistito). */
export function setE1rm(s: SessionSet, loadType: LoadType, opts: RecordOptions): number {
  if (!countsForRecords(s) || loadType === 'assisted') return 0
  const reps = repsDone(s) + (s.type === 'plus' ? opts.plusRepsBonus : 0)
  const load = loadType === 'weighted' ? (s.weight ?? 0) + (opts.bodyweight ?? 0) : (s.weight ?? 0)
  return e1rm(load, reps)
}

/** Migliori prestazioni per esercizio nelle sessioni passate. */
export function computeBests(sessions: Session[], opts: RecordOptions): Map<string, Bests> {
  const bests = new Map<string, Bests>()
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const loadType = opts.loadTypes.get(ex.exerciseId) ?? 'normal'
      let b = bests.get(ex.exerciseId)
      if (!b) bests.set(ex.exerciseId, (b = { e1rm: 0, repsAtWeight: new Map() }))
      for (const s of ex.sets) {
        if (!countsForRecords(s)) continue
        b.e1rm = Math.max(b.e1rm, setE1rm(s, loadType, opts))
        const w = s.weight!
        b.repsAtWeight.set(w, Math.max(b.repsAtWeight.get(w) ?? 0, repsDone(s)))
      }
    }
  }
  return bests
}

/** Il set batte un record rispetto alle sessioni precedenti? (Serve uno storico per quell'esercizio.) */
export function setRecord(
  exerciseId: string,
  s: SessionSet,
  bests: Map<string, Bests>,
  opts: RecordOptions,
): RecordHit | null {
  const b = bests.get(exerciseId)
  if (!b || !countsForRecords(s)) return null
  const loadType = opts.loadTypes.get(exerciseId) ?? 'normal'
  const value = setE1rm(s, loadType, opts)
  const reps = repsDone(s)
  if (b.e1rm > 0 && value > b.e1rm + 1e-9) {
    return { exerciseId, kind: 'e1rm', weight: s.weight!, reps, value, previous: b.e1rm }
  }
  const prevReps = b.repsAtWeight.get(s.weight!)
  if (prevReps !== undefined && reps > prevReps) {
    return { exerciseId, kind: 'reps', weight: s.weight!, reps, value: reps, previous: prevReps }
  }
  return null
}

/** Record battuti in una sessione: al massimo uno per tipo ed esercizio (il migliore). */
export function sessionRecords(session: Session, previous: Session[], opts: RecordOptions): RecordHit[] {
  const bests = computeBests(previous, opts)
  const best = new Map<string, RecordHit>()
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      const hit = setRecord(ex.exerciseId, s, bests, opts)
      if (!hit) continue
      const key = `${hit.exerciseId}:${hit.kind}`
      const cur = best.get(key)
      if (!cur || hit.value > cur.value) best.set(key, hit)
    }
  }
  return [...best.values()]
}
