// Calcoli sui pesi: arrotondamento ed e1RM.
import type { RoundingMode } from './types'

const EPS = 1e-6

/** Arrotonda al multiplo di `step`. "nearest-down": al più vicino, a pari distanza per difetto. */
export function roundWeight(weight: number, step: number, mode: RoundingMode = 'nearest-down'): number {
  if (!(step > 0)) return weight
  const q = weight / step
  const floor = Math.floor(q + EPS)
  const frac = q - floor
  let n: number
  if (mode === 'down') n = floor
  else if (Math.abs(frac - 0.5) < EPS) n = mode === 'nearest-up' ? floor + 1 : floor
  else n = frac > 0.5 ? floor + 1 : floor
  return Math.round(n * step * 1000) / 1000
}

/** e1RM = peso × reps × 0,0333 + peso. */
export function e1rm(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0
  return weight * reps * 0.0333 + weight
}

/** Reps massime stimate a un certo peso, dato l'e1RM (formula inversa). */
export function maxRepsAt(e1rmValue: number, weight: number): number {
  if (!(weight > 0)) return 0
  return (e1rmValue / weight - 1) / 0.0333
}
