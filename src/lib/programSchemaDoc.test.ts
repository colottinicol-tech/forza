// Gli esempi in PROGRAM_SCHEMA.md devono essere sempre accettati dall'app.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaults'
import { validateImport, type ExistingState } from './importSchema'

const doc = readFileSync(new URL('../../PROGRAM_SCHEMA.md', import.meta.url), 'utf8')
const blocks = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1])

describe('PROGRAM_SCHEMA.md', () => {
  it('contiene i due esempi', () => {
    expect(blocks).toHaveLength(2)
  })

  it('gli esempi sono validi (il secondo dopo aver importato il primo)', () => {
    const empty: ExistingState = { exercises: new Map(), lifts: new Map(), settings: { ...DEFAULT_SETTINGS } }
    const full = validateImport(blocks[0], empty)
    if (!full.ok) throw new Error(full.errors.join('\n'))
    expect(full.data.lifts.find((l) => l.exerciseId === 'military')?.pendingTm).toBeTruthy()

    const existing: ExistingState = {
      exercises: new Map(full.data.exercises.map((e) => [e.id, e])),
      lifts: new Map(full.data.lifts.map((l) => [l.exerciseId, l])),
      settings: { ...DEFAULT_SETTINGS, ...full.data.settings },
    }
    const small = validateImport(blocks[1], existing)
    if (!small.ok) throw new Error(small.errors.join('\n'))
    expect(small.preview.join(' ')).toContain('140 → 145')
  })
})
