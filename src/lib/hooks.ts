// Dati letti dal database che si aggiornano da soli quando cambiano.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db, getSettings } from './db'
import { DEFAULT_SETTINGS } from './defaults'
import type { Day, Exercise, Lift, Session, Settings } from './types'

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), [])
}

export function useExercises(): Map<string, Exercise> {
  const list = useLiveQuery(() => db.exercises.toArray(), [])
  return new Map((list ?? []).map((e) => [e.id, e]))
}

export function useLifts(): Lift[] {
  return useLiveQuery(() => db.lifts.toArray(), []) ?? []
}

export function useDays(): Day[] | undefined {
  return useLiveQuery(() => db.days.orderBy('order').toArray(), [])
}

/** Tutti i giorni salvati, anche quelli iniziati e non ancora finiti. */
export function useSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [])
}

export function useDoneSessions(): Session[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.sessions.orderBy('startedAt').reverse().toArray()
    return all.filter((s) => s.status === 'done')
  }, [])
}

/** Tiene lo schermo acceso finché `active` è vero (se il browser lo permette). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock?.release()
      } catch {
        // Non supportato o negato: nessun problema.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [active])
}

export const settingsOrDefault = (s: Settings | undefined) => s ?? DEFAULT_SETTINGS
