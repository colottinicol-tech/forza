// Formattazione in italiano: virgola decimale, date per esteso, pesi e reps dei set.
import type { LoadType, SessionSet } from './types'

const kgFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })

/** 82.5 → "82,5"; 100 → "100" */
export function formatKg(value: number): string {
  return kgFormat.format(value)
}

/** "mercoledì 22 ottobre" */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "70 kg", "assist. 21 kg" (trazioni assistite), "+20 kg" (zavorra), "— kg" se manca. */
export function weightText(w: number | null, loadType: LoadType = 'normal'): string {
  if (w === null) return '— kg'
  if (loadType === 'assisted') return `assist. ${formatKg(w)} kg`
  if (loadType === 'weighted') return `+${formatKg(w)} kg`
  return `${formatKg(w)} kg`
}

/** Reps da fare: "5", "1+", "3-5", "?" se mancano. */
export function targetText(s: SessionSet): string {
  if (s.targetReps === null) return '?'
  if (s.targetRepsMax) return `${s.targetReps}-${s.targetRepsMax}`
  return `${s.targetReps}${s.type === 'plus' ? '+' : ''}`
}
