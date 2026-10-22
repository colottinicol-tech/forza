// "Importa da Claude": incolla (o scegli un file) → controlla → anteprima → applica dopo conferma.
import { useState } from 'react'
import { applyImport } from '../lib/dataio'
import { buildContext } from '../lib/db'
import { validateImport, type ImportResult } from '../lib/importSchema'
import { Button, Sheet } from './controls'

export function ImportSheet({ open, onClose, onApplied }: { open: boolean; onClose: () => void; onApplied: () => void }) {
  return (
    <Sheet open={open} title="Importa da Claude" onClose={onClose} doneLabel="Annulla">
      {open && <Body onApplied={onApplied} />}
    </Sheet>
  )
}

function Body({ onApplied }: { onApplied: () => void }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const check = async (raw: string) => {
    setMessage(null)
    const ctx = await buildContext()
    setResult(validateImport(raw, { exercises: ctx.exercises, lifts: ctx.lifts, settings: ctx.settings }))
  }

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      setText(clip)
      await check(clip)
    } catch {
      setMessage('Non riesco a leggere gli appunti: tieni premuto nel riquadro qui sotto e scegli «Incolla».')
    }
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    const content = await file.text()
    setText(content)
    await check(content)
  }

  const apply = async () => {
    if (!result?.ok) return
    setBusy(true)
    try {
      await applyImport(result.data)
      onApplied()
    } catch {
      setMessage('Qualcosa è andato storto durante il salvataggio. Non è stato cambiato niente: riprova.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-label-2">
        Incolla qui il JSON che Claude ha preparato in chat (programma nuovo, modifiche ai TM, nuovi complementari). Prima di
        cambiare qualcosa ti mostro un'anteprima.
      </p>
      <div className="flex gap-2">
        <Button kind="secondary" className="flex-1" onClick={() => void paste()}>
          Incolla
        </Button>
        <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-card-2 px-4 text-[17px] font-semibold active:opacity-70">
          Scegli file
          <input
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </label>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setResult(null)
        }}
        placeholder="{ &quot;format&quot;: &quot;forza-import&quot;, ... }"
        rows={6}
        className="w-full rounded-xl bg-card-2 px-3 py-3 font-mono text-[16px] outline-none focus:ring-2 focus:ring-accent"
      />
      {message && <p className="text-[15px] text-danger">{message}</p>}
      {!result && (
        <Button onClick={() => void check(text)} disabled={!text.trim()}>
          Controlla
        </Button>
      )}

      {result && !result.ok && (
        <div className="rounded-xl bg-card p-4">
          <p className="font-semibold text-danger">Il JSON non va bene, non ho cambiato niente.</p>
          <p className="mt-1 text-[15px] text-label-2">
            Copia questi errori e incollali nella chat con Claude: ti preparerà una versione corretta.
          </p>
          <ul className="mt-2 list-disc pl-5 text-[14px]">
            {result.errors.slice(0, 30).map((e, i) => (
              <li key={i} className="break-words">
                {e}
              </li>
            ))}
          </ul>
          {result.errors.length > 30 && <p className="mt-1 text-[14px] text-label-2">…e altri {result.errors.length - 30}.</p>}
        </div>
      )}

      {result?.ok && (
        <>
          <div className="rounded-xl bg-card p-4">
            <p className="font-semibold">Anteprima delle modifiche</p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
              {result.preview.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <Button onClick={() => void apply()} disabled={busy}>
            Applica le modifiche
          </Button>
        </>
      )}
    </div>
  )
}
