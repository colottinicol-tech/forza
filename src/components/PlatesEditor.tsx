// Dischi disponibili: quante coppie per ogni peso (onboarding e Impostazioni).
import { useState } from 'react'
import { formatKg } from '../lib/format'
import type { PlateStock } from '../lib/types'
import { Button, Stepper } from './controls'

export function PlatesEditor({ plates, onChange }: { plates: PlateStock[]; onChange: (p: PlateStock[]) => void }) {
  const [newKg, setNewKg] = useState<number | null>(null)
  const sorted = [...plates].sort((a, b) => b.kg - a.kg)
  const set = (kg: number, pairs: number | null) =>
    onChange(sorted.map((p) => (p.kg === kg ? { ...p, pairs: Math.max(0, pairs ?? 0) } : p)))

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-label-2">Coppie disponibili per ogni disco (0 = non ce l'hai).</p>
      {sorted.map((p) => (
        <Stepper key={p.kg} label={`${formatKg(p.kg)} kg`} value={p.pairs} onChange={(v) => set(p.kg, v)} max={20} />
      ))}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1">
          <Stepper label="Nuovo" value={newKg} onChange={setNewKg} step={0.25} decimal suffix="kg" max={50} />
        </div>
      </div>
      <Button
        kind="secondary"
        disabled={!newKg || plates.some((p) => p.kg === newKg)}
        onClick={() => {
          if (!newKg) return
          onChange([...plates, { kg: newKg, pairs: 1 }])
          setNewKg(null)
        }}
      >
        + Aggiungi disco
      </Button>
    </div>
  )
}
