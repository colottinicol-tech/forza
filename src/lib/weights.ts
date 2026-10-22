// Calcoli sui pesi: arrotondamento, e1RM, dischi da caricare.
import type { PlateStock, RoundingMode } from './types'

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

export interface PlateLoad {
  /** Dischi per lato, dal più pesante. */
  perSide: number[]
  /** Kg per lato che non si riescono a caricare con i dischi disponibili. */
  missing: number
}

/** Dischi da mettere per lato per arrivare a `total` con il bilanciere `bar`. */
export function platesPerSide(total: number, bar: number, stock: PlateStock[]): PlateLoad {
  let left = (total - bar) / 2
  const perSide: number[] = []
  if (left <= EPS) return { perSide, missing: 0 }
  const sorted = [...stock].filter((p) => p.kg > 0 && p.pairs > 0).sort((a, b) => b.kg - a.kg)
  for (const plate of sorted) {
    let used = 0
    while (used < plate.pairs && left + EPS >= plate.kg) {
      perSide.push(plate.kg)
      left -= plate.kg
      used++
    }
  }
  return { perSide, missing: Math.max(0, Math.round(left * 1000) / 1000) }
}
