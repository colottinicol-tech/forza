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
  slotKey,
  weeksOfCycle,
} from './program531'
import type { CycleConfig, Lift, Position } from './types'

const settings = { ...DEFAULT_SETTINGS }
const cfg = (over: Partial<CycleConfig> = {}): CycleConfig => ({ ...DEFAULT_SETTINGS.cycleConfig, ...over })
const pos = (cycle: number, weekIdx: number, extra: Position['extra'] = null): Position => ({ cycle, weekIdx, extra })
const lift = (over: Partial<Lift> = {}): Lift => ({ ...defaultLift('x', 100), ...over })

describe('settimane del ciclo', () => {
  it('originale: scarico a ogni ciclo', () => {
    expect(weeksOfCycle(cfg(), 1)).toEqual(['S1', 'S2', 'S3', 'DELOAD'])
  })
  it('scarico ogni 2 cicli', () => {
    const c = cfg({ deloadEvery: 2 })
    expect(weeksOfCycle(c, 1)).toEqual(['S1', 'S2', 'S3'])
    expect(weeksOfCycle(c, 2)).toEqual(['S1', 'S2', 'S3', 'DELOAD'])
    expect(weeksOfCycle(c, 3)).toEqual(['S1', 'S2', 'S3'])
  })
  it('Forever: 2 Leader + 7ª, 1 Anchor + 7ª', () => {
    const c = cfg({ template: 'forever', leaderCycles: 2, anchorCycles: 1, seventhWeek: 'tmtest' })
    expect(weeksOfCycle(c, 1)).toEqual(['S1', 'S2', 'S3'])
    expect(weeksOfCycle(c, 2)).toEqual(['S1', 'S2', 'S3', 'SEVENTH_TEST'])
    expect(weeksOfCycle(c, 3)).toEqual(['S1', 'S2', 'S3', 'SEVENTH_TEST'])
    expect(weeksOfCycle(c, 4)).toEqual(['S1', 'S2', 'S3'])
    expect(positionLabel(c, pos(3, 0))).toBe('Ciclo 3 (Anchor) · S1')
  })
})

describe('avanzamento', () => {
  const c = cfg({ deloadEvery: 2 })
  it('passa alla settimana dopo e al ciclo dopo', () => {
    expect(nextPosition(c, pos(1, 1))).toEqual(pos(1, 2))
    expect(nextPosition(c, pos(1, 2))).toEqual(pos(2, 0))
    expect(nextPosition(c, pos(2, 2))).toEqual(pos(2, 3))
    expect(currentWeek(c, pos(2, 3))).toBe('DELOAD')
    expect(positionLabel(c, pos(2, 3))).toBe('Ciclo 2 · S4 scarico')
  })
  it('ripeti la settimana appena fatta', () => {
    const p = repeatLastWeek(c, pos(1, 2)) // tocca la S3, l'ultima fatta è la S2
    expect(p).toEqual(pos(1, 2, 'S2'))
    expect(currentWeek(c, p)).toBe('S2')
    expect(positionLabel(c, p)).toBe('Ciclo 1 · S2 extra')
    expect(nextPosition(c, p)).toEqual(pos(1, 2)) // poi si riprende dalla S3
  })
  it("ripeti a inizio ciclo torna all'ultima settimana del ciclo prima", () => {
    expect(repeatLastWeek(c, pos(2, 0)).extra).toBe('S3')
    expect(repeatLastWeek(c, pos(1, 0))).toEqual(pos(1, 0))
  })
  it('settimana extra e salto', () => {
    const extra = insertExtraWeek(pos(1, 1), 'DELOAD')
    expect(currentWeek(c, extra)).toBe('DELOAD')
    expect(skipWeek(c, extra)).toEqual(pos(1, 1))
    expect(skipWeek(c, pos(1, 1))).toEqual(pos(1, 2))
  })
  it('ogni settimana ha uno slot diverso, anche quelle extra', () => {
    expect(slotKey(pos(1, 2))).not.toBe(slotKey(pos(1, 2, 'S2')))
  })
})

describe('pesi pianificati', () => {
  it('riscaldamento, lavoro e FSL arrotondati', () => {
    const sets = buildMainSets(lift({ tm: 100, fsl: { S1: { sets: 3, reps: 5 } } }), settings, 'S1')
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
    expect(buildMainSets(lift({ tm: 110, fsl: { S1: { sets: 5, reps: 5 } } }), settings, 'DELOAD').map((s) => s.weight)).toEqual([45, 55, 65])
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
  it("sotto l'obiettivo suggerisce di non aumentare", () => {
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
