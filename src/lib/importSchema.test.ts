// Test con dati finti.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaults'
import { validateImport, type ExistingState } from './importSchema'

const empty: ExistingState = { exercises: new Map(), lifts: new Map(), settings: { ...DEFAULT_SETTINGS } }

const valid = {
  format: 'forza-import',
  version: 1,
  mode: 'replace',
  settings: { roundingStep: 2.5, plusRepsBonus: 1, deloadEvery: 2 },
  position: { cycle: 2, week: 'S1' },
  exercises: [
    { id: 'es-a', name: 'Esercizio A', barbell: true, bodyPart: 'lower', increment: 5 },
    { id: 'es-b', name: 'Esercizio B', loadType: 'assisted', muscles: { dorsali: 1, bicipiti: 0.5 } },
  ],
  lifts: [
    {
      exerciseId: 'es-a',
      tm: 100,
      fsl: { S1: { sets: 3, reps: 5 } },
      tmRules: [{ minReps: 4, increment: 5 }],
      awaitingTmReview: { s3PlusReps: 5 },
    },
  ],
  days: [
    {
      id: 'g1',
      name: 'Giorno 1',
      exercises: [
        { exerciseId: 'es-a', role: 'main531' },
        { exerciseId: 'es-b', role: 'accessory', sets: 3, reps: 10, repMin: 8, repMax: 12, weight: 20, superset: 'A' },
        { exerciseId: 'es-b', role: 'accessory', sets: null, reps: null, weight: null },
      ],
    },
  ],
}

describe('validazione import', () => {
  it("accetta un programma completo e prepara l'anteprima", () => {
    const r = validateImport(valid, empty)
    if (!r.ok) throw new Error(r.errors.join('\n'))
    expect(r.data.position).toEqual({ cycle: 2, weekIdx: 0, extra: null })
    expect(r.data.cycleConfig).toEqual({ deloadEvery: 2 })
    expect(r.data.lifts[0].pendingTm?.proposed).toBe(105)
    expect(r.data.days![0].exercises[2].sets).toBeNull()
    const preview = r.preview.join('\n')
    expect(preview).toContain('Da completare')
    expect(preview).toContain('Si parte da: Ciclo 2 · S1')
    expect(preview).toContain('scarico ogni 2 cicli')
  })

  it('accetta il JSON come testo, anche dentro un blocco ```json', () => {
    const text = 'Ecco il programma:\n```json\n' + JSON.stringify(valid) + '\n```'
    expect(validateImport(text, empty).ok).toBe(true)
  })

  it('rifiuta testo che non è JSON', () => {
    expect(validateImport('ciao', empty).ok).toBe(false)
  })

  it('segnala tutti gli errori con la posizione', () => {
    const bad = {
      ...valid,
      exercises: [{ id: 'es-a', name: 'Esercizio A', loadType: 'boh' }],
      lifts: [{ exerciseId: 'es-a', tm: 'cento' }],
      days: [{ id: 'g1', name: 'G', exercises: [{ exerciseId: 'manca', role: 'accessory' }] }],
    }
    const r = validateImport(bad, empty)
    if (r.ok) throw new Error('doveva fallire')
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('exercises[0].loadType'),
        expect.stringContaining('lifts[0].tm'),
        expect.stringContaining('days[0].exercises[0].exerciseId'),
      ]),
    )
  })

  it('main531 senza voce in "lifts" è un errore', () => {
    expect(validateImport({ ...valid, lifts: [] }, empty).ok).toBe(false)
  })

  it('la posizione non va più dentro i singoli esercizi', () => {
    const lift = { ...valid.lifts[0], position: { cycle: 1, week: 'S1' } }
    const r = validateImport({ ...valid, lifts: [lift] }, empty)
    if (r.ok) throw new Error('doveva fallire')
    expect(r.errors[0]).toContain('"position" in alto')
  })

  it('settimana che non esiste nel ciclo: va indicata come extra', () => {
    expect(validateImport({ ...valid, position: { cycle: 1, week: 'DELOAD' } }, empty).ok).toBe(false)
    expect(validateImport({ ...valid, position: { cycle: 1, week: 'DELOAD', extra: true } }, empty).ok).toBe(true)
  })

  it('formato o versione sbagliati', () => {
    expect(validateImport({ ...valid, format: 'altro' }, empty).ok).toBe(false)
    expect(validateImport({ ...valid, version: 2 }, empty).ok).toBe(false)
  })

  it('modifica solo il TM di un esercizio esistente', () => {
    const r1 = validateImport(valid, empty)
    if (!r1.ok) throw new Error(r1.errors.join('\n'))
    const existing: ExistingState = {
      exercises: new Map(r1.data.exercises.map((e) => [e.id, e])),
      lifts: new Map(r1.data.lifts.map((l) => [l.exerciseId, l])),
      settings: { ...DEFAULT_SETTINGS },
    }
    const r = validateImport({ format: 'forza-import', version: 1, tmChanges: [{ exerciseId: 'es-a', tm: 110 }] }, existing)
    if (!r.ok) throw new Error(r.errors.join('\n'))
    expect(r.preview.join(' ')).toContain('100 → 110')
  })
})
