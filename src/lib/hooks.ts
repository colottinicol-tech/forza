// Dati letti dal database che si aggiornano da soli quando cambiano.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
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

export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(async () => (await db.sessions.where('status').equals('active').first()) ?? null, [])
}

export function useDoneSessions(): Session[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.sessions.orderBy('startedAt').reverse().toArray()
    return all.filter((s) => s.status === 'done')
  }, [])
}

/** Ridisegna ogni `ms` millisecondi (per timer e durata, calcolati da Date.now()). */
export function useNow(ms = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [ms])
  return now
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
