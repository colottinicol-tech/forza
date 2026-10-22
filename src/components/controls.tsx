// Controlli touch: pulsanti, stepper, scelte a pillole, pannello dal basso (sheet).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatKg } from '../lib/format'

export function Button({
  children,
  onClick,
  kind = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'secondary' | 'danger' | 'plain'
  disabled?: boolean
  className?: string
}) {
  const styles = {
    primary: 'bg-accent text-black font-semibold',
    secondary: 'bg-card-2 text-label font-semibold',
    danger: 'bg-card-2 text-danger font-semibold',
    plain: 'text-accent',
  }[kind]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl px-4 text-[17px] active:opacity-70 disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

/** Numero con − e + grandi; il valore si può anche scrivere col tastierino. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  decimal = false,
  suffix,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  min?: number
  max?: number
  decimal?: boolean
  suffix?: string
  label?: string
}) {
  const [text, setText] = useState(value === null ? '' : formatKg(value))
  // Ultimo valore inviato: tocchi rapidi su − / + si sommano anche prima che arrivi il valore salvato.
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
    setText(value === null ? '' : formatKg(value))
  }, [value])
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000))
  const emit = (v: number | null) => {
    latest.current = v
    onChange(v)
  }
  const bump = (delta: number) => emit(clamp((latest.current ?? 0) + delta))
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'))
    if (raw.trim() === '') emit(null)
    else if (Number.isFinite(n)) emit(clamp(n))
    else setText(value === null ? '' : formatKg(value))
  }
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-16 shrink-0 text-[15px] text-label-2">{label}</span>}
      <button
        type="button"
        aria-label="Diminuisci"
        onClick={() => bump(-step)}
        className="size-12 shrink-0 rounded-xl bg-card-2 text-[26px] leading-none active:opacity-70"
      >
        −
      </button>
      <div className="relative flex-1">
        <input
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-12 w-full rounded-xl bg-card-2 text-center text-[22px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-accent"
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[15px] text-label-2">{suffix}</span>
        )}
      </div>
      <button
        type="button"
        aria-label="Aumenta"
        onClick={() => bump(step)}
        className="size-12 shrink-0 rounded-xl bg-card-2 text-[26px] leading-none active:opacity-70"
      >
        +
      </button>
    </div>
  )
}

/** Scelta fra poche opzioni, a pillole. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  allowNone = false,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
  allowNone?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(active && allowNone ? null : o.value)}
            className={`min-h-11 min-w-11 rounded-full px-3.5 text-[15px] font-semibold active:opacity-70 ${
              active ? 'bg-accent text-black' : 'bg-card-2 text-label'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Pannello che sale dal basso, per le modifiche. */
export function Sheet({
  open,
  title,
  onClose,
  children,
  doneLabel = 'Fine',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  doneLabel?: string
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  // Portale su <body>: i pannelli aperti uno dentro l'altro restano a schermo pieno.
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="sheet-backdrop absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="sheet-panel relative flex max-h-[92dvh] flex-col rounded-t-2xl bg-bg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h2 className="truncate text-[17px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 px-2 text-[17px] font-semibold text-accent">
            {doneLabel}
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Conferma semplice dentro un pannello. */
export function useConfirm() {
  const [state, setState] = useState<{ text: string; action: string; run: () => void } | null>(null)
  const ask = (text: string, action: string, run: () => void) => setState({ text, action, run })
  const node = (
    <Sheet open={state !== null} title="Sei sicuro?" onClose={() => setState(null)} doneLabel="Annulla">
      <p className="pb-4 text-[15px] text-label-2">{state?.text}</p>
      <Button
        kind="danger"
        className="w-full"
        onClick={() => {
          state?.run()
          setState(null)
        }}
      >
        {state?.action}
      </Button>
    </Sheet>
  )
  return { ask, node }
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-label-2 uppercase">{label}</span>
      {children}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const cls = 'w-full rounded-xl bg-card-2 px-3 py-3 text-[17px] outline-none focus:ring-2 focus:ring-accent'
  return multiline ? (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
  ) : (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
    >
      <span>{label}</span>
      <span className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-done' : 'bg-card-2'}`}>
        <span
          className={`absolute top-0.5 size-[27px] rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
