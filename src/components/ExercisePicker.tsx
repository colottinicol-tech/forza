// Scelta di un esercizio dall'elenco (con ricerca), o creazione di uno nuovo.
import { useState } from 'react'
import { useExercises } from '../lib/hooks'
import type { Exercise } from '../lib/types'
import { Sheet, TextInput } from './controls'
import { ExerciseEditor } from './ExerciseEditor'

export function ExercisePicker({
  open,
  title,
  onClose,
  onPick,
}: {
  open: boolean
  title: string
  onClose: () => void
  onPick: (ex: Exercise) => void
}) {
  const exercises = useExercises()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const list = [...exercises.values()]
    .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))

  return (
    <>
      <Sheet open={open && !creating} title={title} onClose={onClose} doneLabel="Annulla">
        <div className="flex flex-col gap-3">
          <TextInput value={query} onChange={setQuery} placeholder="Cerca" />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-12 rounded-xl bg-card px-4 text-left font-semibold text-accent"
          >
            + Nuovo esercizio
          </button>
          <div className="divide-y divide-sep overflow-hidden rounded-xl bg-card">
            {list.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onPick(e)}
                className="block min-h-12 w-full px-4 py-3 text-left active:bg-card-2"
              >
                {e.name}
              </button>
            ))}
            {list.length === 0 && <p className="px-4 py-3 text-label-2">Nessun esercizio trovato.</p>}
          </div>
        </div>
      </Sheet>
      <ExerciseEditor
        exercise={null}
        open={open && creating}
        onClose={() => setCreating(false)}
        onSaved={(ex) => {
          setCreating(false)
          onPick(ex)
        }}
      />
    </>
  )
}
