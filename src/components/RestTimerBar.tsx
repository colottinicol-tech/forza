// Barra fissa in basso durante il workout: recupero con −15 s / +15 s.
import { useEffect, useRef } from 'react'
import { useNow } from '../lib/hooks'
import { adjustRest, beep, stopRest } from '../lib/timer'
import type { Settings } from '../lib/types'

export const TIMER_BAR_HEIGHT = 64

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function RestTimerBar({ settings, startedAt }: { settings: Settings; startedAt: number }) {
  const now = useNow(250)
  const timer = settings.timer
  const left = timer ? (timer.endsAt - now) / 1000 : 0
  const finished = timer !== null && left <= 0
  const beeped = useRef<number | null>(null)

  useEffect(() => {
    if (!timer || !finished || beeped.current === timer.endsAt) return
    beeped.current = timer.endsAt
    // Suona solo se il recupero è finito da poco (non riaprendo l'app dopo ore).
    if (settings.sound && now - timer.endsAt < 5000) beep()
  }, [timer, finished, now, settings.sound])

  const elapsed = mmss((now - startedAt) / 1000)
  const progress = timer ? Math.min(1, Math.max(0, 1 - left / timer.total)) : 0

  return (
    <div
      className="fixed inset-x-0 z-20 border-t-[0.5px] border-sep bg-bar backdrop-blur-xl"
      style={{ bottom: 'calc(50px + env(safe-area-inset-bottom))', height: TIMER_BAR_HEIGHT }}
    >
      {timer && (
        <div
          className={`absolute top-0 left-0 h-[3px] ${finished ? 'bg-done' : 'bg-accent'}`}
          style={{ width: `${progress * 100}%` }}
        />
      )}
      <div className="flex h-full items-center gap-2 px-4">
        <div className="min-w-0 flex-1">
          {timer ? (
            <>
              <p className={`text-[28px] leading-none font-bold tabular-nums ${finished ? 'text-done' : ''}`}>
                {finished ? 'Vai!' : mmss(left)}
              </p>
              <p className="mt-1 text-[12px] text-label-2">
                {finished ? 'Recupero finito' : 'Recupero'} · workout {elapsed}
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold">Workout {elapsed}</p>
              <p className="text-[12px] text-label-2">Il recupero parte quando spunti un set</p>
            </>
          )}
        </div>
        {timer && !finished && (
          <>
            <TimerButton label="−15" onClick={() => void adjustRest(-15)} />
            <TimerButton label="+15" onClick={() => void adjustRest(15)} />
          </>
        )}
        {timer && <TimerButton label="✕" aria="Ferma il recupero" onClick={() => void stopRest()} />}
      </div>
    </div>
  )
}

function TimerButton({ label, onClick, aria }: { label: string; onClick: () => void; aria?: string }) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      className="h-11 min-w-12 rounded-xl bg-card-2 px-2 text-[17px] font-semibold tabular-nums active:opacity-70"
    >
      {label}
    </button>
  )
}
