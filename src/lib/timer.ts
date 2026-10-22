// Timer di recupero: si salva l'ora di fine (Date.now()), così resta giusto anche
// se iOS sospende l'app in background.
import { getSettings, updateSettings } from './db'

export async function startRest(seconds: number): Promise<void> {
  if (seconds <= 0) return
  await updateSettings({ timer: { endsAt: Date.now() + seconds * 1000, total: seconds } })
}

export async function adjustRest(deltaSec: number): Promise<void> {
  const { timer } = await getSettings()
  if (!timer) return
  const endsAt = Math.max(Date.now(), timer.endsAt + deltaSec * 1000)
  await updateSettings({ timer: { endsAt, total: Math.max(1, timer.total + deltaSec) } })
}

export async function stopRest(): Promise<void> {
  await updateSettings({ timer: null })
}

// Suono di fine recupero (solo con l'app aperta). iOS lo permette solo dopo un tocco dell'utente.
let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx && AC) ctx = new AC()
    void ctx?.resume()
  } catch {
    ctx = null
  }
}

export function beep(): void {
  if (!ctx) return
  try {
    const now = ctx.currentTime
    for (const [i, freq] of [880, 1175].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.17)
    }
  } catch {
    // Audio non disponibile: resta l'avviso visivo.
  }
}
