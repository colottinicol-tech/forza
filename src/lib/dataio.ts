// Backup (esporta/importa tutti i dati) e applicazione di un import da Claude.
import { db, getSettings, TABLES } from './db'
import type { ImportData } from './importSchema'

export const BACKUP_FORMAT = 'forza-backup'

export async function applyImport(d: ImportData): Promise<void> {
  const settings = await getSettings()
  await db.transaction('rw', [db.settings, db.exercises, db.lifts, db.tmHistory, db.days], async () => {
    const now = Date.now()
    if (d.mode === 'replace') {
      await db.lifts.clear()
      await db.days.clear()
    }
    await db.exercises.bulkPut(d.exercises)
    for (const lift of d.lifts) {
      const prev = await db.lifts.get(lift.exerciseId)
      await db.lifts.put(lift)
      if (!prev || prev.tm !== lift.tm) {
        await db.tmHistory.add({ exerciseId: lift.exerciseId, date: now, tm: lift.tm, reason: 'Importato da Claude' })
      }
    }
    for (const t of d.tmChanges) {
      const lift = await db.lifts.get(t.exerciseId)
      if (!lift) continue
      await db.lifts.put({ ...lift, tm: t.tm, pendingTm: null })
      await db.tmHistory.add({ exerciseId: t.exerciseId, date: now, tm: t.tm, reason: t.reason })
    }
    let { nextDayIdx } = settings
    if (d.days) {
      await db.days.bulkPut(d.days)
      const all = await db.days.orderBy('order').toArray()
      nextDayIdx = d.nextDayId ? Math.max(0, all.findIndex((x) => x.id === d.nextDayId)) : Math.min(nextDayIdx, Math.max(0, all.length - 1))
    }
    await db.settings.put({ ...settings, ...d.settings, nextDayIdx, id: 'main' })
  })
}

/** Tutti i dati in un oggetto JSON. */
export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = await db.table(t).toArray()
  const settings = (data.settings as { timer?: unknown }[])[0]
  if (settings) settings.timer = null
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), data })
}

export function backupFileName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `forza-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

/** Condivide un file con il menu Condividi di iOS (o lo scarica dove non è possibile). */
export async function shareFile(text: string, name: string, type = 'application/json'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const result = await shareFile(await exportAll(), backupFileName())
  if (result !== 'cancelled') {
    const s = await getSettings()
    await db.settings.put({ ...s, lastBackupAt: Date.now() })
  }
  return result
}

export interface BackupSummary {
  exportedAt: string
  counts: Record<string, number>
  data: Record<string, unknown[]>
}

/** Controlla un file di backup. Restituisce un messaggio d'errore leggibile se non va bene. */
export function readBackup(text: string): BackupSummary | string {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return 'Il file non è un backup valido (non è JSON).'
  }
  const o = obj as { format?: unknown; data?: Record<string, unknown> ; exportedAt?: unknown }
  if (o?.format !== BACKUP_FORMAT || typeof o.data !== 'object' || o.data === null) {
    return 'Questo file non è un backup di Forza. Se è un programma generato da Claude, usa «Importa da Claude».'
  }
  const data: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  for (const t of TABLES) {
    const rows = o.data[t]
    if (rows !== undefined && !Array.isArray(rows)) return `Backup danneggiato: la sezione "${t}" non è una lista.`
    data[t] = (rows as unknown[]) ?? []
    counts[t] = data[t].length
  }
  return { exportedAt: String(o.exportedAt ?? ''), counts, data }
}

/** Sostituisce tutti i dati con quelli del backup. */
export async function restoreBackup(b: BackupSummary): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      if (b.data[t].length) await db.table(t).bulkPut(b.data[t])
    }
  })
}
