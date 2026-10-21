// Banner "Aggiorna": la nuova versione si installa solo quando lo tocchi,
// così la pagina non si ricarica mai da sola (ad esempio durante un workout).
import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // iOS non controlla gli aggiornamenti quando riapri l'app dallo sfondo: lo facciamo noi.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, HOUR)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-[10px] bg-card p-3 pl-4">
      <p className="flex-1 text-[15px]">È disponibile una nuova versione di Forza.</p>
      <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 px-2 text-[15px] text-label-2">
        Dopo
      </button>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-11 rounded-lg bg-accent px-4 text-[15px] font-semibold text-black"
      >
        Aggiorna
      </button>
    </div>
  )
}
