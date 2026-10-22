// Prima apertura: unità, arrotondamento dei pesi, bilanciere e dischi.
import { useState } from 'react'
import { Button, Choice, Field } from '../components/controls'
import { updateSettings } from '../lib/db'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import type { RoundingMode, Settings } from '../lib/types'

export const ROUNDING_STEPS = [1, 1.25, 2.5, 5].map((v) => ({ value: v, label: `${v.toLocaleString('it-IT')} kg` }))
export const ROUNDING_MODES: { value: RoundingMode; label: string }[] = [
  { value: 'nearest-down', label: 'Al più vicino' },
  { value: 'down', label: 'Sempre per difetto' },
  { value: 'nearest-up', label: 'Vicino, pari → eccesso' },
]

export function Onboarding() {
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const patch = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }))

  return (
    <section className="flex flex-col gap-6 px-4 pt-6 pb-10">
      <header>
        <img src={`${import.meta.env.BASE_URL}apple-touch-icon-180x180.png`} alt="" className="size-16 rounded-2xl" />
        <h1 className="mt-4 text-[34px] leading-[41px] font-bold tracking-tight">Benvenuto in Forza</h1>
        <p className="mt-2 text-[17px] text-label-2">
          Una sola impostazione e sei pronto. Potrai cambiarle quando vuoi in Impostazioni.
        </p>
      </header>

      <Field label="Unità">
        <Choice options={[{ value: 'kg', label: 'Chilogrammi (kg)' }]} value="kg" onChange={() => {}} />
      </Field>

      <Field label="Arrotondamento dei pesi">
        <div className="flex flex-col gap-3">
          <Choice options={ROUNDING_STEPS} value={s.roundingStep} onChange={(v) => v && patch({ roundingStep: v })} />
          <Choice options={ROUNDING_MODES} value={s.roundingMode} onChange={(v) => v && patch({ roundingMode: v })} />
          <p className="text-[13px] text-label-2">
            «Al più vicino»: 86,25 kg diventa 85 (a pari distanza si scende). I pesi calcolati dal TM useranno questa regola.
          </p>
        </div>
      </Field>

      <Button onClick={() => void updateSettings({ ...s, onboarded: true })}>Inizia</Button>
    </section>
  )
}
