// Programma: esercizi principali 5/3/1 (TM, posizione nel ciclo, riallineamento), giorni, esercizi.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button, Choice, Field, Sheet, Stepper, TextInput, Toggle, useConfirm } from '../components/controls'
import { ExerciseEditor } from '../components/ExerciseEditor'
import { ExercisePicker } from '../components/ExercisePicker'
import { Group, Screen } from '../components/ui'
import { db, setTm, updateSettings } from '../lib/db'
import { defaultLift } from '../lib/defaults'
import { formatKg } from '../lib/format'
import { useDays, useExercises, useLifts, useSettings } from '../lib/hooks'
import {
  currentWeek,
  insertExtraWeek,
  positionLabel,
  repeatLastWeek,
  skipWeek,
  WEEK_LABEL,
  weeksOfCycle,
} from '../lib/program531'
import { newId } from '../lib/session'
import type { Day, Exercise, Lift, PlannedExercise, Settings, WeekKind } from '../lib/types'

export function Programma({ onImport }: { onImport: () => void }) {
  const settings = useSettings()
  const lifts = useLifts()
  const days = useDays()
  const exercises = useExercises()
  const [liftId, setLiftId] = useState<string | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)
  const [editEx, setEditEx] = useState<Exercise | null | 'new'>(null)
  const [addingLift, setAddingLift] = useState(false)
  const [newLiftEx, setNewLiftEx] = useState<Exercise | null>(null)

  if (!settings || !days) return null
  const name = (id: string) => exercises.get(id)?.name ?? id

  const addDay = async () => {
    const day: Day = { id: newId(), name: `Giorno ${days.length + 1}`, order: days.length, exercises: [] }
    await db.days.add(day)
    setDayId(day.id)
  }

  return (
    <Screen title="Programma">
      <Group header="Esercizi principali 5/3/1" footer="Tocca un esercizio per il TM o per ripetere, inserire o saltare una settimana.">
        {lifts.map((l) => (
          <button
            key={l.exerciseId}
            type="button"
            onClick={() => setLiftId(l.exerciseId)}
            className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0"
          >
            <div className="flex min-h-14 items-center justify-between gap-3 border-t-[0.5px] border-sep py-2.5 pr-4">
              <span>
                <span className="block font-semibold">{name(l.exerciseId)}</span>
                <span className="block text-[13px] text-label-2">{positionLabel(l)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums">TM {formatKg(l.tm)}</span>
                {l.pendingTm && <span className="block text-[13px] text-accent">nuovo TM da confermare</span>}
              </span>
            </div>
          </button>
        ))}
        <button type="button" onClick={() => setAddingLift(true)} className="block min-h-12 w-full border-t-[0.5px] border-sep px-4 text-left text-accent first:border-t-0">
          + Aggiungi esercizio principale
        </button>
      </Group>

      <Group header="Giorni (in sequenza)" footer="Dopo l'ultimo giorno si riparte dal primo: un giro completo è un microciclo.">
        {days.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDayId(d.id)}
            className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0"
          >
            <div className="flex min-h-14 items-center justify-between gap-3 border-t-[0.5px] border-sep py-2.5 pr-4">
              <span className="min-w-0">
                <span className="block font-semibold">{d.name}</span>
                <span className="block truncate text-[13px] text-label-2">
                  {d.exercises.map((pe) => name(pe.exerciseId)).join(', ') || 'Nessun esercizio'}
                </span>
              </span>
              {i === settings.nextDayIdx && <span className="shrink-0 text-[13px] font-semibold text-accent">prossimo</span>}
            </div>
          </button>
        ))}
        <button type="button" onClick={() => void addDay()} className="block min-h-12 w-full border-t-[0.5px] border-sep px-4 text-left text-accent first:border-t-0">
          + Aggiungi giorno
        </button>
      </Group>

      <Group header={`Esercizi (${exercises.size})`}>
        {[...exercises.values()]
          .sort((a, b) => a.name.localeCompare(b.name, 'it'))
          .map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEditEx(e)}
              className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0"
            >
              <div className="flex min-h-12 items-center justify-between gap-3 border-t-[0.5px] border-sep py-2 pr-4">
                <span>{e.name}</span>
                <span className="shrink-0 text-[13px] text-label-2">
                  {Object.entries(e.muscles)
                    .filter(([, v]) => v === 1)
                    .map(([m]) => m)
                    .join(', ')}
                </span>
              </div>
            </button>
          ))}
        <button type="button" onClick={() => setEditEx('new')} className="block min-h-12 w-full border-t-[0.5px] border-sep px-4 text-left text-accent first:border-t-0">
          + Nuovo esercizio
        </button>
      </Group>

      <div className="px-4">
        <Button kind="secondary" className="w-full" onClick={onImport}>
          Importa da Claude
        </Button>
      </div>

      {liftId && <LiftSheet lift={lifts.find((l) => l.exerciseId === liftId)} name={name(liftId)} settings={settings} onClose={() => setLiftId(null)} />}
      {dayId && (
        <DaySheet
          day={days.find((d) => d.id === dayId)}
          index={days.findIndex((d) => d.id === dayId)}
          days={days}
          exercises={exercises}
          lifts={lifts}
          settings={settings}
          onClose={() => setDayId(null)}
        />
      )}
      <ExerciseEditor exercise={editEx === 'new' ? null : editEx} open={editEx !== null} onClose={() => setEditEx(null)} />
      <ExercisePicker
        open={addingLift}
        title="Quale esercizio principale?"
        onClose={() => setAddingLift(false)}
        onPick={(e) => {
          setAddingLift(false)
          setNewLiftEx(e)
        }}
      />
      {newLiftEx && <NewLiftSheet exercise={newLiftEx} exists={lifts.some((l) => l.exerciseId === newLiftEx.id)} onClose={() => setNewLiftEx(null)} settings={settings} />}
    </Screen>
  )
}

function NewLiftSheet({ exercise, exists, onClose, settings }: { exercise: Exercise; exists: boolean; onClose: () => void; settings: Settings }) {
  const [tm, setTmValue] = useState<number | null>(null)
  return (
    <Sheet open title={exercise.name} onClose={onClose} doneLabel="Annulla">
      {exists ? (
        <p className="text-[15px] text-label-2">È già un esercizio principale 5/3/1.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Training Max (TM)">
            <Stepper value={tm} onChange={setTmValue} step={settings.roundingStep} decimal suffix="kg" />
          </Field>
          <p className="text-[13px] text-label-2">Se non lo conosci: circa il 90% del tuo massimale.</p>
          <Button
            disabled={!tm}
            onClick={async () => {
              if (!tm) return
              await db.lifts.put(defaultLift(exercise.id, tm))
              await db.tmHistory.add({ exerciseId: exercise.id, date: Date.now(), tm, reason: 'TM iniziale' })
              onClose()
            }}
          >
            Aggiungi
          </Button>
        </div>
      )}
    </Sheet>
  )
}

const EXTRA_OPTIONS: { value: WeekKind; label: string }[] = [
  { value: 'S1', label: 'S1' },
  { value: 'S2', label: 'S2' },
  { value: 'S3', label: 'S3' },
  { value: 'DELOAD', label: 'Scarico' },
  { value: 'SEVENTH_DELOAD', label: '7ª scarico' },
  { value: 'SEVENTH_TEST', label: '7ª test TM' },
]

function LiftSheet({ lift, name, settings, onClose }: { lift: Lift | undefined; name: string; settings: Settings; onClose: () => void }) {
  const confirm = useConfirm()
  const [tm, setTmValue] = useState<number | null>(lift?.tm ?? null)
  const [extra, setExtra] = useState<WeekKind | null>(null)
  const history = useLiveQuery(() => db.tmHistory.where('exerciseId').equals(lift?.exerciseId ?? '').reverse().sortBy('date'), [lift?.exerciseId])
  if (!lift) return null

  const save = (patch: Partial<Lift>) => void db.lifts.put({ ...lift, ...patch })
  const prevWeekLabel = (() => {
    const p = repeatLastWeek(lift)
    return p.extra ? WEEK_LABEL[p.extra] : null
  })()
  const after = (p: Lift['position']) => positionLabel({ ...lift, position: p })

  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {lift.pendingTm && (
          <div className="rounded-xl border border-accent/40 bg-card p-4">
            <p className="font-semibold">Nuovo TM proposto: {formatKg(lift.pendingTm.proposed)} kg</p>
            <p className="text-[15px] text-label-2">{lift.pendingTm.reason}</p>
            <Button className="mt-3 w-full" onClick={() => void setTm(lift.exerciseId, lift.pendingTm!.proposed, `Fine ciclo: ${lift.pendingTm!.reason}`)}>
              Conferma {formatKg(lift.pendingTm.proposed)} kg
            </Button>
          </div>
        )}

        <Field label="Training Max">
          <div className="flex flex-col gap-2">
            <Stepper value={tm} onChange={setTmValue} step={settings.roundingStep} decimal suffix="kg" />
            <Button kind="secondary" disabled={!tm || tm === lift.tm} onClick={() => tm && void setTm(lift.exerciseId, tm, 'Modifica manuale')}>
              Salva TM
            </Button>
          </div>
        </Field>

        <Field label="Posizione nel ciclo">
          <div className="flex flex-col gap-3">
            <p className="text-[20px] font-bold">{positionLabel(lift)}</p>
            <Button
              kind="secondary"
              disabled={!prevWeekLabel}
              onClick={() =>
                confirm.ask(
                  `La prossima volta rifai la ${prevWeekLabel}, poi riprendi con ${WEEK_LABEL[currentWeek(lift)]}.`,
                  `Ripeti ${prevWeekLabel ?? ''}`,
                  () => save({ position: repeatLastWeek(lift) }),
                )
              }
            >
              Ripeti la settimana precedente{prevWeekLabel ? ` (${prevWeekLabel})` : ''}
            </Button>
            <div className="rounded-xl bg-card p-3">
              <p className="mb-2 text-[15px]">Inserisci una settimana extra prima della prossima:</p>
              <Choice options={EXTRA_OPTIONS} value={extra} onChange={setExtra} />
              <Button
                kind="secondary"
                className="mt-3 w-full"
                disabled={!extra}
                onClick={() =>
                  extra &&
                  confirm.ask(`La prossima volta fai una ${WEEK_LABEL[extra]} extra. Il ciclo poi continua da dove era.`, 'Inserisci', () => {
                    save({ position: insertExtraWeek(lift, extra) })
                    setExtra(null)
                  })
                }
              >
                Inserisci settimana extra
              </Button>
            </div>
            <Button
              kind="secondary"
              onClick={() =>
                confirm.ask(`Salti la ${WEEK_LABEL[currentWeek(lift)]}: si passa a ${after(skipWeek(lift))}. Il TM non cambia.`, 'Salta', () =>
                  save({ position: skipWeek(lift) }),
                )
              }
            >
              Salta questa settimana
            </Button>
          </div>
        </Field>

        <Field label="Schema">
          <div className="flex flex-col gap-3">
            <Choice
              options={[
                { value: 'original', label: '5/3/1 originale' },
                { value: 'forever', label: '5/3/1 Forever' },
              ]}
              value={lift.template}
              onChange={(v) => v && save({ template: v, position: { ...lift.position, weekIdx: Math.min(lift.position.weekIdx, 2) } })}
            />
            {lift.template === 'original' ? (
              <Stepper
                label="Scarico ogni"
                value={lift.deloadEvery}
                onChange={(v) => save({ deloadEvery: Math.max(1, v ?? 1), position: clampPos(lift, { deloadEvery: Math.max(1, v ?? 1) }) })}
                min={1}
                max={6}
                suffix={lift.deloadEvery === 1 ? 'ciclo' : 'cicli'}
              />
            ) : (
              <>
                <Stepper label="Leader" value={lift.leaderCycles} onChange={(v) => save({ leaderCycles: Math.max(1, v ?? 1) })} min={1} max={6} suffix="cicli" />
                <Stepper label="Anchor" value={lift.anchorCycles} onChange={(v) => save({ anchorCycles: Math.max(0, v ?? 0) })} min={0} max={6} suffix="cicli" />
                <Choice
                  options={[
                    { value: 'deload', label: '7ª: scarico' },
                    { value: 'tmtest', label: '7ª: test del TM' },
                  ]}
                  value={lift.seventhWeek}
                  onChange={(v) => v && save({ seventhWeek: v })}
                />
              </>
            )}
          </div>
        </Field>

        <Field label="FSL (peso del primo set)">
          <div className="flex flex-col gap-2">
            {(['S1', 'S2', 'S3'] as const).map((w) => (
              <div key={w} className="flex items-center gap-2">
                <span className="w-8 font-semibold">{w}</span>
                <div className="flex-1">
                  <Stepper value={lift.fsl[w]?.sets ?? 0} onChange={(v) => save({ fsl: { ...lift.fsl, [w]: { sets: v ?? 0, reps: lift.fsl[w]?.reps ?? 5 } } })} max={10} suffix="set" />
                </div>
                <div className="flex-1">
                  <Stepper value={lift.fsl[w]?.reps ?? 5} onChange={(v) => save({ fsl: { ...lift.fsl, [w]: { sets: lift.fsl[w]?.sets ?? 0, reps: Math.max(1, v ?? 5) } } })} min={1} max={20} suffix="reps" />
                </div>
              </div>
            ))}
            <p className="text-[13px] text-label-2">0 set = niente FSL in quella settimana. Nello scarico l'FSL non si fa.</p>
          </div>
        </Field>

        <Field label="Regola del nuovo TM (set «+» della S3)">
          <TmRulesEditor lift={lift} settings={settings} onChange={(tmRules) => save({ tmRules })} />
        </Field>

        <Field label="Recuperi (secondi)">
          <div className="flex flex-col gap-2">
            <Stepper label="Lavoro" value={lift.rest.work} onChange={(v) => save({ rest: { ...lift.rest, work: v ?? 0 } })} step={15} />
            <Stepper label="Prima del +" value={lift.rest.beforePlus} onChange={(v) => save({ rest: { ...lift.rest, beforePlus: v ?? 0 } })} step={15} />
            <Stepper label="Dopo il +" value={lift.rest.afterPlus} onChange={(v) => save({ rest: { ...lift.rest, afterPlus: v ?? 0 } })} step={15} />
            <Stepper label="FSL" value={lift.rest.fsl} onChange={(v) => save({ rest: { ...lift.rest, fsl: v ?? 0 } })} step={15} />
            <Stepper label="FSL, reps perse" value={lift.rest.fslMissed} onChange={(v) => save({ rest: { ...lift.rest, fslMissed: v ?? 0 } })} step={15} />
          </div>
        </Field>

        <Field label="Storico del TM">
          <ul className="divide-y divide-sep rounded-xl bg-card">
            {(history ?? []).map((h) => (
              <li key={h.id} className="flex justify-between gap-3 px-4 py-2.5 text-[15px]">
                <span className="text-label-2">
                  {new Date(h.date).toLocaleDateString('it-IT')} · {h.reason}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatKg(h.tm)} kg</span>
              </li>
            ))}
            {history?.length === 0 && <li className="px-4 py-2.5 text-label-2">Nessuna modifica registrata.</li>}
          </ul>
        </Field>

        <Button
          kind="danger"
          onClick={() =>
            confirm.ask(`${name} non sarà più un esercizio principale 5/3/1. Lo storico dei workout resta.`, 'Togli dai principali', () => {
              void db.lifts.delete(lift.exerciseId)
              onClose()
            })
          }
        >
          Togli dai principali
        </Button>
      </div>
      {confirm.node}
    </Sheet>
  )
}

/** Se cambia la cadenza dello scarico, la posizione deve restare dentro il ciclo. */
function clampPos(lift: Lift, patch: Partial<Lift>): Lift['position'] {
  const next = { ...lift, ...patch }
  const len = weeksOfCycle(next, lift.position.cycle).length
  return { ...lift.position, weekIdx: Math.min(lift.position.weekIdx, len - 1) }
}

function TmRulesEditor({ lift, settings, onChange }: { lift: Lift; settings: Settings; onChange: (r: Lift['tmRules']) => void }) {
  const rules = [...lift.tmRules].sort((a, b) => b.minReps - a.minReps)
  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && (
        <p className="text-[15px] text-label-2">
          Regola standard: se il set «+» arriva almeno all'obiettivo, +{formatKg(settings.upperIncrement)} kg (upper) o +
          {formatKg(settings.lowerIncrement)} kg (lower); altrimenti TM invariato.
        </p>
      )}
      {rules.map((r, i) => (
        <div key={i} className="rounded-xl bg-card p-3">
          <Stepper label="Reps ≥" value={r.minReps} onChange={(v) => onChange(rules.map((x, j) => (j === i ? { ...x, minReps: v ?? 0 } : x)))} max={30} />
          <div className="mt-2">
            <Stepper label="TM +" value={r.increment} onChange={(v) => onChange(rules.map((x, j) => (j === i ? { ...x, increment: v ?? 0 } : x)))} step={settings.roundingStep} decimal suffix="kg" />
          </div>
          <button type="button" className="mt-1 min-h-11 text-[15px] text-danger" onClick={() => onChange(rules.filter((_, j) => j !== i))}>
            Togli questa soglia
          </button>
        </div>
      ))}
      {rules.length > 0 && <p className="text-[13px] text-label-2">Sotto tutte le soglie: TM invariato.</p>}
      <Button kind="secondary" onClick={() => onChange([...rules, { minReps: rules.length ? rules[rules.length - 1].minReps - 1 : 4, increment: settings.upperIncrement }])}>
        + Aggiungi soglia
      </Button>
    </div>
  )
}

function DaySheet({
  day,
  index,
  days,
  exercises,
  lifts,
  settings,
  onClose,
}: {
  day: Day | undefined
  index: number
  days: Day[]
  exercises: Map<string, Exercise>
  lifts: Lift[]
  settings: Settings
  onClose: () => void
}) {
  const confirm = useConfirm()
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  if (!day) return null
  const save = (patch: Partial<Day>) => void db.days.put({ ...day, ...patch })
  const setExercises = (list: PlannedExercise[]) => save({ exercises: list })

  const moveDay = async (dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= days.length) return
    const other = days[j]
    await db.transaction('rw', db.days, async () => {
      await db.days.put({ ...day, order: other.order })
      await db.days.put({ ...other, order: day.order })
    })
  }

  return (
    <Sheet open title={day.name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <Field label="Nome">
          <TextInput value={day.name} onChange={(name) => save({ name })} />
        </Field>

        <Field label="Esercizi">
          <div className="divide-y divide-sep overflow-hidden rounded-xl bg-card">
            {day.exercises.map((pe, i) => (
              <button key={i} type="button" onClick={() => setEditing(i)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-card-2">
                <span className="min-w-0">
                  <span className={`block ${pe.role === 'main531' ? 'font-semibold' : ''}`}>
                    {pe.superset && <span className="mr-1 text-[13px] text-accent">{pe.superset}</span>}
                    {exercises.get(pe.exerciseId)?.name ?? '?'}
                  </span>
                  <span className="block text-[13px] text-label-2">{plannedSummary(pe)}</span>
                </span>
                <span className="text-label-3">›</span>
              </button>
            ))}
            {day.exercises.length === 0 && <p className="px-4 py-3 text-label-2">Nessun esercizio.</p>}
          </div>
        </Field>
        <Button kind="secondary" onClick={() => setPicking(true)}>
          + Aggiungi esercizio
        </Button>

        <div className="flex gap-3">
          <Button kind="secondary" className="flex-1" disabled={index === 0} onClick={() => void moveDay(-1)}>
            ↑ Prima
          </Button>
          <Button kind="secondary" className="flex-1" disabled={index === days.length - 1} onClick={() => void moveDay(1)}>
            ↓ Dopo
          </Button>
        </div>
        <Button kind="secondary" disabled={settings.nextDayIdx === index} onClick={() => void updateSettings({ nextDayIdx: index })}>
          {settings.nextDayIdx === index ? 'È il prossimo allenamento' : 'Fallo come prossimo allenamento'}
        </Button>
        <Button
          kind="danger"
          onClick={() =>
            confirm.ask(`Eliminare «${day.name}» dal programma? Lo storico dei workout resta.`, 'Elimina giorno', async () => {
              await db.transaction('rw', db.days, db.settings, async () => {
                await db.days.delete(day.id)
                const rest = (await db.days.orderBy('order').toArray()).filter((d) => d.id !== day.id)
                for (const [i, d] of rest.entries()) await db.days.put({ ...d, order: i })
                await updateSettings({ nextDayIdx: Math.min(settings.nextDayIdx, Math.max(0, rest.length - 1)) })
              })
              onClose()
            })
          }
        >
          Elimina giorno
        </Button>
      </div>
      {confirm.node}
      <ExercisePicker
        open={picking}
        title="Aggiungi al giorno"
        onClose={() => setPicking(false)}
        onPick={(e) => {
          const isLift = lifts.some((l) => l.exerciseId === e.id) && !day.exercises.some((p) => p.exerciseId === e.id && p.role === 'main531')
          const pe: PlannedExercise = isLift
            ? { exerciseId: e.id, role: 'main531' }
            : { exerciseId: e.id, role: 'accessory', sets: 3, reps: 10, repMin: 8, repMax: 12, weight: null, rpeMax: 9, progression: 'double' }
          setExercises([...day.exercises, pe])
          setPicking(false)
          setEditing(day.exercises.length)
        }}
      />
      {editing !== null && day.exercises[editing] && (
        <PlannedSheet
          pe={day.exercises[editing]}
          name={exercises.get(day.exercises[editing].exerciseId)?.name ?? '?'}
          canBeMain={lifts.some((l) => l.exerciseId === day.exercises[editing].exerciseId)}
          settings={settings}
          onChange={(pe) => setExercises(day.exercises.map((x, i) => (i === editing ? pe : x)))}
          onMove={(dir) => {
            const j = editing + dir
            if (j < 0 || j >= day.exercises.length) return
            const list = [...day.exercises]
            ;[list[editing], list[j]] = [list[j], list[editing]]
            setExercises(list)
            setEditing(j)
          }}
          onRemove={() => {
            setExercises(day.exercises.filter((_, i) => i !== editing))
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </Sheet>
  )
}

export function plannedSummary(pe: PlannedExercise): string {
  if (pe.role === 'main531') return '5/3/1 + FSL (dal TM)'
  const parts: string[] = []
  parts.push(pe.sets != null && (pe.reps != null || pe.repMax != null) ? `${pe.sets}×${pe.reps ?? pe.repMax}` : 'set e reps da completare')
  if (pe.repMin != null && pe.repMax != null) parts.push(pe.repMin === pe.repMax ? `fisso ${pe.repMax}` : `range ${pe.repMin}-${pe.repMax}`)
  parts.push(pe.weight != null ? `${formatKg(pe.weight)} kg` : 'peso da completare')
  if (pe.progression === 'none') parts.push('senza progressione')
  return parts.join(' · ')
}

function PlannedSheet({
  pe,
  name,
  canBeMain,
  settings,
  onChange,
  onMove,
  onRemove,
  onClose,
}: {
  pe: PlannedExercise
  name: string
  canBeMain: boolean
  settings: Settings
  onChange: (pe: PlannedExercise) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onClose: () => void
}) {
  const set = (patch: Partial<PlannedExercise>) => onChange({ ...pe, ...patch })
  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {canBeMain && (
          <Field label="Ruolo in questo giorno">
            <Choice
              options={[
                { value: 'main531', label: 'Principale 5/3/1' },
                { value: 'accessory', label: 'Complementare' },
              ]}
              value={pe.role}
              onChange={(v) => v && set({ role: v })}
            />
          </Field>
        )}
        {pe.role === 'accessory' && (
          <>
            <Stepper label="Set" value={pe.sets ?? null} onChange={(v) => set({ sets: v })} min={1} max={20} />
            <Stepper label="Reps" value={pe.reps ?? null} onChange={(v) => set({ reps: v })} min={1} max={100} />
            <Field label="Range per la doppia progressione">
              <div className="flex flex-col gap-2">
                <Stepper label="Da" value={pe.repMin ?? null} onChange={(v) => set({ repMin: v })} min={1} max={100} />
                <Stepper label="A" value={pe.repMax ?? null} onChange={(v) => set({ repMax: v })} min={1} max={100} />
                <Stepper label="RPE max" value={pe.rpeMax ?? null} onChange={(v) => set({ rpeMax: v })} step={0.5} min={5} max={10} decimal />
              </div>
            </Field>
            <Stepper label="Peso" value={pe.weight ?? null} onChange={(v) => set({ weight: v })} step={settings.roundingStep} decimal suffix="kg" />
            <div className="rounded-xl bg-card px-4 py-1">
              <Toggle label="Doppia progressione" checked={pe.progression !== 'none'} onChange={(v) => set({ progression: v ? 'double' : 'none' })} />
            </div>
          </>
        )}
        <Stepper label="Recupero" value={pe.restSec ?? null} onChange={(v) => set({ restSec: v })} step={15} suffix="s" />
        <p className="-mt-3 text-[13px] text-label-2">Vuoto = recupero di default dell'esercizio.</p>
        <Field label="Superset (stessa lettera = alternati)">
          <Choice options={['A', 'B', 'C', 'D'].map((l) => ({ value: l, label: l }))} value={pe.superset ?? null} onChange={(v) => set({ superset: v })} allowNone />
        </Field>
        <Field label="Note">
          <TextInput value={pe.notes ?? ''} onChange={(notes) => set({ notes })} multiline />
        </Field>
        <div className="flex gap-3">
          <Button kind="secondary" className="flex-1" onClick={() => onMove(-1)}>
            ↑ Sposta su
          </Button>
          <Button kind="secondary" className="flex-1" onClick={() => onMove(1)}>
            ↓ Sposta giù
          </Button>
        </div>
        <Button kind="danger" onClick={onRemove}>
          Togli dal giorno
        </Button>
      </div>
    </Sheet>
  )
}
