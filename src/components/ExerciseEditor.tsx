// Creazione e modifica di un esercizio (con i coefficienti muscolari proposti da confermare).
import { useState } from 'react'
import { db } from '../lib/db'
import { defaultExercise, MUSCLES, suggestMuscles } from '../lib/defaults'
import { newId } from '../lib/session'
import type { Exercise } from '../lib/types'
import { Button, Choice, Field, Sheet, Stepper, TextInput, Toggle } from './controls'

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || newId()

export function ExerciseEditor({
  exercise,
  open,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null
  open: boolean
  onClose: () => void
  onSaved?: (ex: Exercise) => void
}) {
  return (
    <Sheet open={open} title={exercise ? exercise.name : 'Nuovo esercizio'} onClose={onClose} doneLabel="Annulla">
      {open && <EditorBody exercise={exercise} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function EditorBody({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null
  onClose: () => void
  onSaved?: (ex: Exercise) => void
}) {
  const [ex, setEx] = useState<Exercise>(() => exercise ?? defaultExercise('', ''))
  const [touchedMuscles, setTouchedMuscles] = useState(exercise !== null)
  const patch = (p: Partial<Exercise>) => setEx((e) => ({ ...e, ...p }))

  const setName = (name: string) => {
    // Per un esercizio nuovo i muscoli proposti seguono il nome, finché non li tocchi.
    if (!touchedMuscles) patch({ name, muscles: suggestMuscles(name) })
    else patch({ name })
  }
  const setMuscle = (m: string, v: number | null) => {
    setTouchedMuscles(true)
    const muscles = { ...ex.muscles }
    if (v === null || v === 0) delete muscles[m]
    else muscles[m] = v
    patch({ muscles })
  }

  const save = async () => {
    const name = ex.name.trim()
    if (!name) return
    let id = ex.id
    if (!id) {
      id = slug(name)
      if (await db.exercises.get(id)) id = `${id}-${newId().slice(0, 4)}`
    }
    const saved = { ...ex, id, name }
    await db.exercises.put(saved)
    onSaved?.(saved)
    onClose()
  }

  const suggested = !exercise && Object.keys(ex.muscles).length > 0 && !touchedMuscles

  return (
    <div className="flex flex-col gap-5">
      <Field label="Nome">
        <TextInput value={ex.name} onChange={setName} placeholder="Es. Panca inclinata" />
      </Field>
      <div className="rounded-xl bg-card px-4 py-1">
        <Toggle label="Con bilanciere (calcolo dischi)" checked={ex.barbell} onChange={(barbell) => patch({ barbell })} />
        <Toggle label="Conta nel volume" checked={ex.countsForVolume} onChange={(countsForVolume) => patch({ countsForVolume })} />
      </div>
      <Field label="Tipo di carico">
        <Choice
          value={ex.loadType}
          onChange={(v) => v && patch({ loadType: v })}
          options={[
            { value: 'normal', label: 'Peso' },
            { value: 'assisted', label: 'Assistenza' },
            { value: 'weighted', label: 'Zavorra' },
          ]}
        />
      </Field>
      <Field label="Parte del corpo (incremento del TM)">
        <Choice
          value={ex.bodyPart}
          onChange={(v) => v && patch({ bodyPart: v })}
          options={[
            { value: 'upper', label: 'Upper' },
            { value: 'lower', label: 'Lower' },
          ]}
        />
      </Field>
      <Field label="Incremento di peso">
        <Stepper value={ex.increment} onChange={(v) => patch({ increment: v ?? 0 })} step={0.5} decimal suffix="kg" />
      </Field>
      <Field label="Recupero di default">
        <Stepper value={ex.restSec} onChange={(v) => patch({ restSec: v ?? 0 })} step={15} suffix="s" />
      </Field>
      <Field label="Muscoli (1 = diretto, ½ = indiretto)">
        {suggested && (
          <p className="mb-2 text-[13px] text-accent">Coefficienti proposti in base al nome: controllali e conferma salvando.</p>
        )}
        <div className="divide-y divide-sep rounded-xl bg-card">
          {MUSCLES.map((m) => (
            <div key={m} className="flex items-center justify-between gap-2 px-4 py-1.5">
              <span className="text-[15px] capitalize">{m}</span>
              <Choice
                value={ex.muscles[m] ?? null}
                onChange={(v) => setMuscle(m, v)}
                allowNone
                options={[
                  { value: 0.5, label: '½' },
                  { value: 1, label: '1' },
                ]}
              />
            </div>
          ))}
        </div>
      </Field>
      <Field label="Note">
        <TextInput value={ex.notes ?? ''} onChange={(notes) => patch({ notes })} multiline />
      </Field>
      <Button onClick={() => void save()} disabled={!ex.name.trim()}>
        Salva
      </Button>
    </div>
  )
}
