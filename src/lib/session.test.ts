// Test con dati finti.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, defaultExercise, defaultLift } from './defaults'
import { computeBests, sessionRecords, setRecord } from './records'
import { buildSession, finishEffects, restAfterSet, type BuildContext } from './session'
import type { Day, Lift, Session, SessionSet } from './types'

function ctxWith(lift: Lift, over: Partial<BuildContext> = {}): BuildContext {
  const main = { ...defaultExercise('main', 'Esercizio A'), barbell: true }
  const acc = defaultExercise('acc', 'Esercizio B')
  return {
    exercises: new Map([
      ['main', main],
      ['acc', acc],
    ]),
    lifts: new Map([['main', lift]]),
    settings: { ...DEFAULT_SETTINGS },
    lastSets: new Map(),
    ...over,
  }
}

const day: Day = {
  id: 'd1',
  name: 'Giorno 1',
  order: 0,
  exercises: [
    { exerciseId: 'main', role: 'main531' },
    { exerciseId: 'acc', role: 'accessory', sets: 4, reps: 10, weight: 30 },
  ],
}

describe('creazione del workout', () => {
  it('principale dal TM, complementare dal piano', () => {
    const s = buildSession(day, ctxWith({ ...defaultLift('main', 100), deloadEvery: 2 }))
    expect(s.deload).toBe(false)
    expect(s.exercises[0].week).toBe('S1')
    expect(s.exercises[1].sets).toHaveLength(4)
    expect(s.exercises[1].sets[0].weight).toBe(30)
  })
  it("complementare: usa il peso dell'ultima volta", () => {
    const last: SessionSet = { type: 'normal', weight: 32.5, targetReps: 10, reps: 10, rpe: null, done: true }
    const ctx = ctxWith(defaultLift('main', 100), { lastSets: new Map([['acc', [last]]]) })
    expect(buildSession(day, ctx).exercises[1].sets[0].weight).toBe(32.5)
  })
  it('microciclo di scarico: complementari a metà set', () => {
    const lift = { ...defaultLift('main', 100), position: { cycle: 1, weekIdx: 3, extra: null } }
    const s = buildSession(day, ctxWith(lift))
    expect(s.deload).toBe(true)
    expect(s.exercises[1].sets).toHaveLength(2)
  })
})

describe('recuperi', () => {
  it('lavoro 2\', prima e dopo il set "+" 3\', FSL 2\' o 2\'30" se perdi reps', () => {
    const lift = { ...defaultLift('main', 100), fsl: { S1: { sets: 2, reps: 5 } } }
    const s = buildSession(day, ctxWith(lift))
    const sets = s.exercises[0].sets // 3 riscaldamento, 3 lavoro, 2 FSL
    expect(restAfterSet(s, 0, 0, lift)).toBe(60)
    expect(restAfterSet(s, 0, 3, lift)).toBe(120)
    expect(restAfterSet(s, 0, 4, lift)).toBe(180)
    expect(restAfterSet(s, 0, 5, lift)).toBe(180)
    sets[6].done = true
    sets[6].reps = 5
    expect(restAfterSet(s, 0, 6, lift)).toBe(120)
    sets[6].reps = 4
    expect(restAfterSet(s, 0, 6, lift)).toBe(150)
    expect(restAfterSet(s, 1, 0, lift)).toBe(90)
  })
  it("superset: nessun timer finché manca l'altro esercizio", () => {
    const lift = defaultLift('main', 100)
    const d: Day = {
      ...day,
      exercises: [
        { exerciseId: 'acc', role: 'accessory', sets: 2, reps: 10, superset: 'A' },
        { exerciseId: 'main', role: 'accessory', sets: 2, reps: 10, superset: 'A' },
      ],
    }
    const s = buildSession(d, ctxWith(lift))
    expect(restAfterSet(s, 0, 0, lift)).toBe(0)
    expect(restAfterSet(s, 1, 0, lift)).toBe(90)
  })
})

describe('chiusura del workout', () => {
  const doneAll = (s: Session, plusReps: number) => {
    for (const ex of s.exercises)
      for (const set of ex.sets) {
        set.done = true
        if (set.type === 'plus') set.reps = plusReps
      }
    return s
  }
  it('avanza il principale e il giorno', () => {
    const ctx = ctxWith(defaultLift('main', 100))
    const s = doneAll(buildSession(day, ctx), 7)
    const fx = finishEffects(s, ctx, ['d1', 'd2'])
    expect(fx.lifts[0].position).toEqual({ cycle: 1, weekIdx: 1, extra: null })
    expect(fx.lifts[0].pendingTm).toBeNull()
    expect(fx.nextDayIdx).toBe(1)
    expect(fx.microcycle).toBe(1)
  })
  it("dopo la S3 propone il nuovo TM; l'ultimo giorno chiude il microciclo", () => {
    const lift = { ...defaultLift('main', 100), deloadEvery: 2, position: { cycle: 1, weekIdx: 2, extra: null } }
    const ctx = ctxWith(lift)
    const s = doneAll(buildSession(day, ctx), 4)
    const fx = finishEffects(s, ctx, ['d0', 'd1'])
    expect(fx.lifts[0].position).toEqual({ cycle: 2, weekIdx: 0, extra: null })
    expect(fx.lifts[0].pendingTm?.proposed).toBe(102.5)
    expect(fx.nextDayIdx).toBe(0)
    expect(fx.microcycle).toBe(2)
  })
  it('se il principale non è stato fatto non avanza', () => {
    const ctx = ctxWith(defaultLift('main', 100))
    expect(finishEffects(buildSession(day, ctx), ctx, ['d1']).lifts).toHaveLength(0)
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
    startedAt: 0,
    endedAt: 0,
    status: 'done',
    notes: '',
    microcycle: 1,
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
    expect(setRecord('e', set(60, 12), bests, opts)).toBeNull() // e1RM più basso e peso mai fatto
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
