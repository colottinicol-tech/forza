import { describe, expect, it } from 'vitest'
import { e1rm, maxRepsAt, roundWeight } from './weights'

describe('roundWeight', () => {
  it('arrotonda al 2,5 più vicino', () => {
    expect(roundWeight(78.6, 2.5)).toBe(77.5)
    expect(roundWeight(79, 2.5)).toBe(80)
    expect(roundWeight(100, 2.5)).toBe(100)
  })
  it('a pari distanza va per difetto (default) o per eccesso', () => {
    expect(roundWeight(86.25, 2.5)).toBe(85)
    expect(roundWeight(86.25, 2.5, 'nearest-up')).toBe(87.5)
  })
  it('modalità sempre per difetto e passi diversi', () => {
    expect(roundWeight(87.4, 2.5, 'down')).toBe(85)
    expect(roundWeight(63.1, 1)).toBe(63)
    expect(roundWeight(61.9, 1.25)).toBe(62.5)
  })
  it('resiste agli errori dei numeri decimali', () => {
    // 100 × 0,85 = 84,99999999999999 in virgola mobile
    expect(roundWeight(100 * 0.85, 2.5)).toBe(85)
  })
})

describe('e1rm', () => {
  it('usa peso × reps × 0,0333 + peso', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.65, 5)
    expect(e1rm(80, 0)).toBe(0)
  })
  it('la formula inversa torna alle reps', () => {
    expect(maxRepsAt(e1rm(60, 10), 60)).toBeCloseTo(10, 5)
  })
})
