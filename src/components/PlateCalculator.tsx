// Calcolatore dischi: cosa caricare per lato del bilanciere.
import { useState } from 'react'
import { formatKg } from '../lib/format'
import type { Settings } from '../lib/types'
import { platesPerSide } from '../lib/weights'
import { Sheet, Stepper } from './controls'

const PLATE_COLORS: Record<number, string> = {
  25: 'bg-red-500',
  20: 'bg-blue-500',
  15: 'bg-yellow-400',
  10: 'bg-green-500',
  5: 'bg-zinc-100',
}

export function PlateCalculator({
  open,
  onClose,
  initial,
  settings,
}: {
  open: boolean
  onClose: () => void
  initial: number | null
  settings: Settings
}) {
  return (
    <Sheet open={open} title="Dischi per lato" onClose={onClose}>
      {open && <Body initial={initial} settings={settings} />}
    </Sheet>
  )
}

function Body({ initial, settings }: { initial: number | null; settings: Settings }) {
  const [total, setTotal] = useState<number | null>(initial ?? settings.barWeight)
  const load = platesPerSide(total ?? 0, settings.barWeight, settings.plates)
  const tooLight = (total ?? 0) < settings.barWeight

  return (
    <div className="flex flex-col gap-5">
      <Stepper value={total} onChange={setTotal} step={settings.roundingStep} decimal suffix="kg" />
      <p className="text-center text-[15px] text-label-2">Bilanciere da {formatKg(settings.barWeight)} kg</p>

      {/* Disegno del lato del bilanciere */}
      <div className="flex h-36 items-center justify-center gap-1 rounded-xl bg-card px-3" aria-hidden="true">
        <div className="h-3 w-10 rounded-l bg-zinc-400" />
        {load.perSide.map((kg, i) => {
          const h = Math.max(36, Math.min(128, 40 + kg * 4))
          return (
            <div
              key={i}
              style={{ height: h }}
              className={`flex w-6 items-center justify-center rounded ${PLATE_COLORS[kg] ?? 'bg-zinc-500'}`}
            />
          )
        })}
        <div className="h-3 flex-1 rounded-r bg-zinc-400" />
      </div>

      {tooLight ? (
        <p className="text-center text-[17px]">Meno del peso del bilanciere.</p>
      ) : load.perSide.length === 0 ? (
        <p className="text-center text-[17px]">Solo il bilanciere.</p>
      ) : (
        <p className="text-center text-[22px] font-semibold tabular-nums">{load.perSide.map(formatKg).join(' + ')}</p>
      )}
      {load.missing > 0 && (
        <p className="rounded-xl bg-card p-3 text-center text-[15px] text-danger">
          Con i dischi disponibili mancano {formatKg(load.missing)} kg per lato. Controlla i dischi in Impostazioni.
        </p>
      )}
    </div>
  )
}
