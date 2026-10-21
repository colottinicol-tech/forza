import { describe, expect, it } from 'vitest'
import { formatKg } from './format'

describe('formatKg', () => {
  it('usa la virgola e niente decimali inutili', () => {
    expect(formatKg(82.5)).toBe('82,5')
    expect(formatKg(100)).toBe('100')
    expect(formatKg(61.25)).toBe('61,25')
  })
})
