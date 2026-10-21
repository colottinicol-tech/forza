// Avviso mostrato quando l'app è aperta in Safari invece che dall'icona sulla Home.
import { useState } from 'react'
import { isStandalone } from '../lib/platform'

export function SafariNotice() {
  const [visible, setVisible] = useState(() => !isStandalone())
  if (!visible) return null

  return (
    <div className="mx-4 mt-2 rounded-[10px] border border-accent/40 bg-card p-4">
      <p className="text-[15px] font-semibold">Stai usando Forza dentro Safari</p>
      <p className="mt-1 text-[15px] text-label-2">
        Qui iOS può cancellare i dati, che inoltre sono separati da quelli dell'app installata. Per usarla davvero:
        tocca il pulsante Condividi (il quadrato con la freccia), poi «Aggiungi alla schermata Home», e apri Forza
        dall'icona.
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="mt-2 min-h-11 text-[15px] font-semibold text-accent"
      >
        Ho capito
      </button>
    </div>
  )
}
