// Formattazione in italiano: virgola decimale, date per esteso.

const kgFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })

/** 82.5 → "82,5"; 100 → "100" */
export function formatKg(value: number): string {
  return kgFormat.format(value)
}

/** "mercoledì 22 ottobre" */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}
