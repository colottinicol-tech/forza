// Test con dati finti.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, defaultExercise, defaultLift } from './defaults'
import { slotKey } from './program531'
import { computeBests, sessionRecords, setRecord } from './records'
import { afterDayDone, completeDay, planDay, plusSets, type BuildContext } from './session'
import type { Day, Lift, Position, Session, SessionSet } from './types'

function ctxWith(lifts: Lift[], over: Partial<BuildContext> = {}, deloadEvery = 2): BuildContext {
  return {
    exercises: new Map([
      ['a', { ...defaultExercise('a', 'Esercizio A'), barbell: true, bodyPart: 'upper' as const }],
      ['b', { ...defaultExercise('b', 'Esercizio B'), barbell: true, bodyPart: 'lower' as const }],
      ['acc', defaultExercise('acc', 'Complementare')],
    ]),
    lifts: new Map(lifts.map((l) => [l.exerciseId, l])),
    settings: { ...DEFAULT_SETTINGS, cycleConfig: { ...DEFAULT_SETTINGS.cycleConfig, deloadEvery } },
    lastSets: new Map(),
    ...over,
  }
}

const dayA: Day = {
  id: 'd1',
  name: 'Giorno 1',
  order: 0,
  exercises: [
    { exerciseId: 'a', role: 'main531' },
    { exerciseId: 'acc', role: 'accessory', sets: 4, reps: 10, weight: 30 },
  ],
}
const dayB: Day = { id: 'd2', name: 'Giorno 2', order: 1, exercises: [{ exerciseId: 'b', role: 'main531' }] }
const p = (cycle: number, weekIdx: number): Position => ({ cycle, weekIdx, extra: null })

describe('cosa fare in un giorno', () => {
  it('principale dal TM della settimana, complementare dal piano', () => {
    const plan = planDay(dayA, ctxWith([defaultLift('a', 100)]), p(1, 2))
    expect(plan[0].week).toBe('S3')
    expect(plan[0].sets.find((s) => s.type === 'plus')?.weight).toBe(95)
    expect(plan[1].sets).toHaveLength(4)
    expect(plan[1].sets[0].weight).toBe(30)
  })
  it("complementare: peso dell'ultima volta", () => {
    const last: SessionSet = { type: 'normal', weight: 32.5, targetReps: 10, reps: 10, rpe: null, done: true }
    const ctx = ctxWith([defaultLift('a', 100)], { lastSets: new Map([['accessory:acc', [last]]]) })
    expect(planDay(dayA, ctx, p(1, 0))[1].sets[0].weight).toBe(32.5)
  })
  it('settimana di scarico: complementari a metà set', () => {
    const plan = planDay(dayA, ctxWith([defaultLift('a', 100)]), p(2, 3))
    expect(plan[0].week).toBe('DELOAD')
    expect(plan[1].sets).toHaveLength(2)
  })
  it('il set "+" del giorno', () => {
    expect(plusSets(planDay(dayA, ctxWith([defaultLift('a', 100)]), p(1, 0)))).toEqual([{ exerciseId: 'a', weight: 85, target: 5 }])
    expect(plusSets(planDay(dayA, ctxWith([defaultLift('a', 100)]), p(2, 3)))).toEqual([])
  })
})

describe('Fatto e avanzamento della settimana', () => {
  const lifts = [defaultLift('a', 100), defaultLift('b', 150)]

  it('"Fatto" registra il giorno con le reps del set "+"', () => {
    const s = completeDay(dayA, ctxWith(lifts), p(1, 0), new Map([['a', 9]]))
    expect(s.slot).toBe(slotKey(p(1, 0)))
    expect(s.status).toBe('done')
    expect(s.exercises[0].sets.every((x) => x.done)).toBe(true)
    expect(s.exercises[0].sets.find((x) => x.type === 'plus')?.reps).toBe(9)
  })

  it('la settimana avanza solo quando tutti i giorni sono fatti', () => {
    const ctx = ctxWith(lifts)
    const s1 = completeDay(dayA, ctx, p(1, 0), new Map())
    expect(afterDayDone([dayA, dayB], [s1], ctx, p(1, 0))).toBeNull()
    const s2 = completeDay(dayB, ctx, p(1, 0), new Map())
    expect(afterDayDone([dayA, dayB], [s1, s2], ctx, p(1, 0))).toEqual({ position: p(1, 1), pendingTm: [] })
  })

  it('finita la S3 propone il nuovo TM a tutti i principali', () => {
    const ctx = ctxWith(lifts)
    const s1 = completeDay(dayA, ctx, p(1, 2), new Map([['a', 3]]))
    const s2 = completeDay(dayB, ctx, p(1, 2), new Map([['b', 0]]))
    const fx = afterDayDone([dayA, dayB], [s1, s2], ctx, p(1, 2))
    expect(fx?.position).toEqual(p(2, 0))
    expect(fx?.pendingTm).toEqual([
      { exerciseId: 'a', pendingTm: { proposed: 102.5, reason: expect.stringContaining('+2,5') } },
      { exerciseId: 'b', pendingTm: { proposed: 150, reason: expect.stringContaining('meglio non aumentare') } },
    ])
  })
})

describe('record personali', () => {
  const opts = { plusRepsBonus: 1, loadTypes: new Map(), bodyweight: null }
  const set = (weight: number, reps: number, type: SessionSet['type'] = 'normal'): SessionSet => ({
    type,
    weight,
    targetReps: reps,
    reps,
    rpe: null,
    done: true,
  })
  const session = (sets: SessionSet[]): Session => ({
    id: 's',
    dayId: null,
    dayName: '',
    slot: '1:0:',
    cycle: 1,
    week: 'S1',
    startedAt: 0,
    endedAt: 0,
    status: 'done',
    notes: '',
    deload: false,
    exercises: [{ key: 'k', exerciseId: 'e', role: 'accessory', notes: '', restSec: 90, sets }],
  })

  it('e1RM: il set "+" conta reps + 1', () => {
    const bests = computeBests([session([set(100, 5, 'plus')])], opts)
    expect(bests.get('e')!.e1rm).toBeCloseTo(100 * 6 * 0.0333 + 100, 5)
  })
  it('record di e1RM', () => {
    const bests = computeBests([session([set(80, 8), set(100, 3)])], opts)
    expect(setRecord('e', set(100, 5), bests, opts)?.kind).toBe('e1rm')
    expect(setRecord('e', set(80, 8), bests, opts)).toBeNull()
    expect(setRecord('e', set(60, 12), bests, opts)).toBeNull()
  })
  it('record di reps a parità di peso', () => {
    const bests = computeBests([session([set(100, 5), set(60, 10)])], opts)
    expect(setRecord('e', set(60, 11), bests, opts)?.kind).toBe('reps')
  })
  it('il riscaldamento non conta e la prima volta non è un record', () => {
    expect(sessionRecords(session([set(100, 5)]), [], opts)).toEqual([])
    expect(sessionRecords(session([set(200, 5, 'warmup')]), [session([set(100, 5)])], opts)).toEqual([])
  })
})
