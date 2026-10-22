// Test con dati finti (TM tondi), non con un programma reale.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, defaultLift } from './defaults'
import {
  buildMainSets,
  currentWeek,
  insertExtraWeek,
  nextPosition,
  positionLabel,
  proposeTm,
  repeatLastWeek,
  skipWeek,
  weeksOfCycle,
} from './program531'
import type { Lift } from './types'

const settings = { ...DEFAULT_SETTINGS }
const lift = (over: Partial<Lift> = {}): Lift => ({ ...defaultLift('x', 100), ...over })
const at = (l: Lift, cycle: number, weekIdx: number, extra: Lift['position']['extra'] = null): Lift => ({
  ...l,
  position: { cycle, weekIdx, extra },
})

describe('settimane del ciclo', () => {
  it('originale: scarico a ogni ciclo', () => {
    expect(weeksOfCycle(lift(), 1)).toEqual(['S1', 'S2', 'S3', 'DELOAD'])
  })
  it('scarico ogni 2 cicli', () => {
    const l = lift({ deloadEvery: 2 })
    expect(weeksOfCycle(l, 1)).toEqual(['S1', 'S2', 'S3'])
    expect(weeksOfCycle(l, 2)).toEqual(['S1', 'S2', 'S3', 'DELOAD'])
    expect(weeksOfCycle(l, 3)).toEqual(['S1', 'S2', 'S3'])
  })
  it('Forever: 2 Leader + 7ª, 1 Anchor + 7ª', () => {
    const l = lift({ template: 'forever', leaderCycles: 2, anchorCycles: 1, seventhWeek: 'tmtest' })
    expect(weeksOfCycle(l, 1)).toEqual(['S1', 'S2', 'S3'])
    expect(weeksOfCycle(l, 2)).toEqual(['S1', 'S2', 'S3', 'SEVENTH_TEST'])
    expect(weeksOfCycle(l, 3)).toEqual(['S1', 'S2', 'S3', 'SEVENTH_TEST'])
    expect(weeksOfCycle(l, 4)).toEqual(['S1', 'S2', 'S3'])
    expect(positionLabel(at(l, 3, 0))).toBe('Ciclo 3 (Anchor) · S1')
  })
})

describe('avanzamento', () => {
  it('passa alla settimana dopo e al ciclo dopo', () => {
    const l = lift({ deloadEvery: 2 })
    expect(nextPosition(at(l, 1, 1))).toEqual({ cycle: 1, weekIdx: 2, extra: null })
    expect(nextPosition(at(l, 1, 2))).toEqual({ cycle: 2, weekIdx: 0, extra: null })
    expect(nextPosition(at(l, 2, 2))).toEqual({ cycle: 2, weekIdx: 3, extra: null })
    expect(currentWeek(at(l, 2, 3))).toBe('DELOAD')
  })
  it('ripeti la settimana appena fatta', () => {
    const l = at(lift(), 1, 2) // tocca la S3, l'ultima fatta è la S2
    const p = repeatLastWeek(l)
    expect(p).toEqual({ cycle: 1, weekIdx: 2, extra: 'S2' })
    const repeated = { ...l, position: p }
    expect(currentWeek(repeated)).toBe('S2')
    expect(positionLabel(repeated)).toBe('Ciclo 1 · S2 extra')
    // Fatta la ripetizione, si riprende dalla S3.
    expect(nextPosition(repeated)).toEqual({ cycle: 1, weekIdx: 2, extra: null })
  })
  it('ripeti a inizio ciclo torna all\'ultima settimana del ciclo prima', () => {
    expect(repeatLastWeek(at(lift({ deloadEvery: 2 }), 2, 0)).extra).toBe('S3')
    expect(repeatLastWeek(at(lift(), 1, 0))).toEqual({ cycle: 1, weekIdx: 0, extra: null })
  })
  it('settimana extra e salto', () => {
    const l = at(lift(), 1, 1)
    const extra = { ...l, position: insertExtraWeek(l, 'DELOAD') }
    expect(currentWeek(extra)).toBe('DELOAD')
    expect(skipWeek(extra)).toEqual({ cycle: 1, weekIdx: 1, extra: null })
    expect(skipWeek(l)).toEqual({ cycle: 1, weekIdx: 2, extra: null })
  })
})

describe('set pianificati', () => {
  it('riscaldamento, lavoro e FSL arrotondati', () => {
    const l = lift({ tm: 100, fsl: { S1: { sets: 3, reps: 5 } } })
    const sets = buildMainSets(l, settings, 'S1')
    expect(sets.map((s) => [s.type, s.weight, s.targetReps])).toEqual([
      ['warmup', 40, 5],
      ['warmup', 50, 5],
      ['warmup', 60, 3],
      ['normal', 65, 5],
      ['normal', 75, 5],
      ['plus', 85, 5],
      ['fsl', 65, 5],
      ['fsl', 65, 5],
      ['fsl', 65, 5],
    ])
  })
  it('scarico senza riscaldamento né FSL', () => {
    const l = lift({ tm: 110, fsl: { S1: { sets: 5, reps: 5 } } })
    expect(buildMainSets(l, settings, 'DELOAD').map((s) => s.weight)).toEqual([45, 55, 65])
  })
  it('7ª settimana di scarico: 80% × 3-5', () => {
    const sets = buildMainSets(lift({ tm: 100 }), settings, 'SEVENTH_DELOAD').filter((s) => s.type !== 'warmup')
    expect(sets.map((s) => s.weight)).toEqual([70, 80, 90, 100])
    expect(sets[1].targetRepsMax).toBe(5)
  })
})

describe('proposta del nuovo TM', () => {
  const upper = { bodyPart: 'upper' as const }
  const lower = { bodyPart: 'lower' as const }
  it('regola standard: +2,5 upper, +5 lower se il set "+" raggiunge l\'obiettivo', () => {
    expect(proposeTm(lift({ tm: 100 }), upper, settings, 3).proposed).toBe(102.5)
    expect(proposeTm(lift({ tm: 100 }), lower, settings, 1).proposed).toBe(105)
  })
  it('sotto l\'obiettivo suggerisce di non aumentare', () => {
    const p = proposeTm(lift({ tm: 100 }), lower, settings, 0)
    expect(p.proposed).toBe(100)
    expect(p.reason).toContain('meglio non aumentare')
  })
  it('regole a soglie personalizzate', () => {
    const l = lift({ tm: 100, tmRules: [{ minReps: 3, increment: 2.5 }, { minReps: 4, increment: 5 }] })
    expect(proposeTm(l, lower, settings, 6).proposed).toBe(105)
    expect(proposeTm(l, lower, settings, 3).proposed).toBe(102.5)
    expect(proposeTm(l, lower, settings, 2).proposed).toBe(100)
  })
  it('set "+" non registrato: invariato', () => {
    expect(proposeTm(lift({ tm: 100 }), upper, settings, null).proposed).toBe(100)
  })
})
