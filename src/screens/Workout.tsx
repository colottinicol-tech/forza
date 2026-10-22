// Workout attivo: set da spuntare, set "+", modifiche, note, superset, dischi, fine workout.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Button, Choice, Sheet, Stepper, TextInput, useConfirm } from '../components/controls'
import { ExercisePicker } from '../components/ExercisePicker'
import { PlateCalculator } from '../components/PlateCalculator'
import { db, finishSession, lastSetsByExercise } from '../lib/db'
import { formatKg } from '../lib/format'
import { useDays, useDoneSessions, useExercises, useLifts, useNow, useWakeLock } from '../lib/hooks'
import { WEEK_LABEL } from '../lib/program531'
import { computeBests, sessionRecords, setE1rm, setRecord, type RecordOptions } from '../lib/records'
import { buildSessionExercise, repsDone, restAfterSet } from '../lib/session'
import { startRest, stopRest, unlockAudio } from '../lib/timer'
import type { Exercise, LoadType, Session, SessionExercise, SessionSet, Settings } from '../lib/types'

/** Modifica la sessione leggendo sempre l'ultima versione salvata (tap veloci non si perdono). */
async function mutate(id: string, fn: (s: Session) => void): Promise<Session | undefined> {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return undefined
    fn(s)
    await db.sessions.put(s)
    return s
  })
}

export function weightText(w: number | null, loadType: LoadType = 'normal'): string {
  if (w === null) return '— kg'
  if (loadType === 'assisted') return `assist. ${formatKg(w)} kg`
  if (loadType === 'weighted') return `+${formatKg(w)} kg`
  return `${formatKg(w)} kg`
}

export function targetText(s: SessionSet): string {
  if (s.targetReps === null) return '?'
  if (s.targetRepsMax) return `${s.targetReps}-${s.targetRepsMax}`
  return `${s.targetReps}${s.type === 'plus' ? '+' : ''}`
}

const SET_LABEL: Record<SessionSet['type'], string> = { warmup: 'R', normal: '', plus: '', fsl: 'FSL', joker: 'J' }

export function Workout({ session, settings }: { session: Session; settings: Settings }) {
  const exercises = useExercises()
  const lifts = useLifts()
  const liftMap = useMemo(() => new Map(lifts.map((l) => [l.exerciseId, l])), [lifts])
  const done = useDoneSessions()
  const days = useDays()
  const bodyweight = useLiveQuery(() => db.bodyweight.orderBy('date').last(), [])
  useWakeLock(true)

  const lastSets = useMemo(() => lastSetsByExercise(done ?? []), [done])
  const recordOpts: RecordOptions = useMemo(
    () => ({
      plusRepsBonus: settings.plusRepsBonus,
      loadTypes: new Map([...exercises.values()].map((e) => [e.id, e.loadType])),
      bodyweight: bodyweight?.kg ?? null,
    }),
    [settings.plusRepsBonus, exercises, bodyweight],
  )
  const bests = useMemo(() => computeBests(done ?? [], recordOpts), [done, recordOpts])
  const plan = days?.find((d) => d.id === session.dayId)

  const [editing, setEditing] = useState<{ ex: number; set: number } | null>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const [plates, setPlates] = useState<{ weight: number | null } | null>(null)
  const [picker, setPicker] = useState<{ replace: number | null } | null>(null)
  const [finishing, setFinishing] = useState(false)

  const update = (fn: (s: Session) => void) => mutate(session.id, fn)

  const toggleSet = async (exIdx: number, setIdx: number) => {
    unlockAudio()
    let nowDone = false
    const updated = await update((s) => {
      const set = s.exercises[exIdx].sets[setIdx]
      set.done = !set.done
      nowDone = set.done
      if (set.done && set.reps === null) set.reps = set.targetReps
    })
    if (!updated || !nowDone) return
    const ex = updated.exercises[exIdx]
    const rest = restAfterSet(updated, exIdx, setIdx, liftMap.get(ex.exerciseId))
    if (rest > 0) await startRest(rest)
    else await stopRest()
  }

  const addExercise = async (picked: Exercise, replaceIdx: number | null) => {
    const ctx = { exercises, lifts: liftMap, settings, lastSets }
    const pe = plan?.exercises.find((p) => p.exerciseId === picked.id) ?? {
      exerciseId: picked.id,
      role: 'accessory' as const,
      sets: 3,
      reps: 10,
    }
    const fresh = buildSessionExercise({ ...pe, role: 'accessory', superset: null }, ctx, session.deload)
    await update((s) => {
      if (replaceIdx === null) s.exercises.push(fresh)
      else s.exercises[replaceIdx] = { ...fresh, superset: s.exercises[replaceIdx].superset ?? null }
    })
    setPicker(null)
    setMenu(null)
  }

  // Raggruppa gli esercizi in superset consecutivi per disegnarli insieme.
  const blocks: { letter: string | null; items: number[] }[] = []
  session.exercises.forEach((ex, i) => {
    const prev = blocks[blocks.length - 1]
    if (ex.superset && prev?.letter === ex.superset) prev.items.push(i)
    else blocks.push({ letter: ex.superset ?? null, items: [i] })
  })

  return (
    <section className="pb-4">
      <header className="flex items-end justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-wide text-label-2 uppercase">
            Workout in corso{session.deload ? ' · scarico' : ''}
          </p>
          <h1 className="truncate text-[30px] leading-tight font-bold tracking-tight">{session.dayName}</h1>
        </div>
        <Button kind="primary" className="shrink-0 !min-h-10 !text-[15px]" onClick={() => setFinishing(true)}>
          Termina
        </Button>
      </header>

      <div className="flex flex-col gap-4">
        {blocks.map((block) => (
          <div key={block.items.map((i) => session.exercises[i].key).join()} className={block.letter ? 'mx-2 rounded-2xl border-2 border-accent/50 pt-2' : ''}>
            {block.letter && (
              <p className="px-4 pb-1 text-[13px] font-semibold text-accent uppercase">
                Superset {block.letter} · alternali
              </p>
            )}
            <div className="flex flex-col gap-4">
              {block.items.map((i) => (
                <ExerciseCard
                  key={session.exercises[i].key}
                  ex={session.exercises[i]}
                  exercise={exercises.get(session.exercises[i].exerciseId)}
                  planText={planText(plan?.exercises.find((p) => p.exerciseId === session.exercises[i].exerciseId))}
                  lastSets={lastSets.get(session.exercises[i].exerciseId)}
                  recordFor={(s) => setRecord(session.exercises[i].exerciseId, s, bests, recordOpts)}
                  e1rmFor={(s) => setE1rm(s, exercises.get(session.exercises[i].exerciseId)?.loadType ?? 'normal', recordOpts)}
                  onToggle={(setIdx) => void toggleSet(i, setIdx)}
                  onEdit={(setIdx) => setEditing({ ex: i, set: setIdx })}
                  onPlusReps={(setIdx, reps) =>
                    void update((s) => {
                      s.exercises[i].sets[setIdx].reps = Math.max(0, reps)
                    })
                  }
                  onMenu={() => setMenu(i)}
                  onPlates={(w) => setPlates({ weight: w })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4 px-4">
        <Button kind="secondary" onClick={() => setPicker({ replace: null })}>
          + Aggiungi esercizio
        </Button>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-label-2 uppercase">Note del workout</p>
          <TextInput
            value={session.notes}
            onChange={(notes) => void update((s) => void (s.notes = notes))}
            placeholder="Come è andata, sensazioni, dolori…"
            multiline
          />
        </div>
        <Button onClick={() => setFinishing(true)}>Termina workout</Button>
      </div>

      {editing && (
        <SetEditor
          session={session}
          exIdx={editing.ex}
          setIdx={editing.set}
          exercise={exercises.get(session.exercises[editing.ex]?.exerciseId ?? '')}
          step={settings.roundingStep}
          onClose={() => setEditing(null)}
          update={update}
        />
      )}
      {menu !== null && session.exercises[menu] && (
        <ExerciseMenu
          session={session}
          idx={menu}
          exercise={exercises.get(session.exercises[menu].exerciseId)}
          onClose={() => setMenu(null)}
          update={update}
          onReplace={() => setPicker({ replace: menu })}
          onPlates={() => {
            const ex = session.exercises[menu]
            setPlates({ weight: ex.sets.find((s) => !s.done)?.weight ?? ex.sets[0]?.weight ?? null })
            setMenu(null)
          }}
        />
      )}
      <PlateCalculator open={plates !== null} onClose={() => setPlates(null)} initial={plates?.weight ?? null} settings={settings} />
      <ExercisePicker
        open={picker !== null}
        title={picker?.replace != null ? 'Sostituisci con' : 'Aggiungi esercizio'}
        onClose={() => setPicker(null)}
        onPick={(ex) => void addExercise(ex, picker?.replace ?? null)}
      />
      {finishing && (
        <FinishSheet
          session={session}
          exercises={exercises}
          previous={done ?? []}
          recordOpts={recordOpts}
          onClose={() => setFinishing(false)}
        />
      )}
    </section>
  )
}

function planText(pe: { sets?: number | null; reps?: number | null; repMin?: number | null; repMax?: number | null } | undefined) {
  if (!pe) return null
  const sr = pe.sets && pe.reps ? `${pe.sets}×${pe.reps}` : null
  const range = pe.repMin && pe.repMax && pe.repMin !== pe.repMax ? `range ${pe.repMin}-${pe.repMax}` : null
  return [sr, range].filter(Boolean).join(' · ') || null
}

function ExerciseCard({
  ex,
  exercise,
  planText,
  lastSets,
  recordFor,
  e1rmFor,
  onToggle,
  onEdit,
  onPlusReps,
  onMenu,
  onPlates,
}: {
  ex: SessionExercise
  exercise: Exercise | undefined
  planText: string | null
  lastSets: SessionSet[] | undefined
  recordFor: (s: SessionSet) => ReturnType<typeof setRecord>
  e1rmFor: (s: SessionSet) => number
  onToggle: (setIdx: number) => void
  onEdit: (setIdx: number) => void
  onPlusReps: (setIdx: number, reps: number) => void
  onMenu: () => void
  onPlates: (w: number | null) => void
}) {
  const loadType = exercise?.loadType ?? 'normal'
  const meta =
    ex.role === 'main531' && ex.week
      ? `Ciclo ${ex.cycle} · ${WEEK_LABEL[ex.week]} · TM ${formatKg(ex.tm ?? 0)} kg`
      : planText
  const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.done)

  // Numerazione dei set di lavoro (1, 2, 3...) e "ultima volta" per tipo di set.
  let workN = 0
  const byType = new Map<string, number>()
  const lastOf = (s: SessionSet) => {
    if (s.type === 'warmup' || !lastSets) return null
    const kind = s.type === 'fsl' ? 'fsl' : 'work'
    const n = byType.get(kind) ?? 0
    byType.set(kind, n + 1)
    const prev = lastSets.filter((p) => (p.type === 'fsl' ? 'fsl' : 'work') === kind)[n]
    return prev && prev.done ? `${formatKg(prev.weight ?? 0)}×${repsDone(prev)}` : null
  }

  return (
    <div className="mx-4 overflow-hidden rounded-[12px] bg-card">
      <div className="flex items-start gap-2 px-4 pt-3 pb-1">
        <div className="min-w-0 flex-1">
          <h2 className={`text-[19px] leading-tight font-bold ${allDone ? 'text-done' : ''}`}>
            {allDone && '✓ '}
            {exercise?.name ?? 'Esercizio eliminato'}
          </h2>
          {meta && <p className="mt-0.5 text-[13px] text-label-2">{meta}</p>}
          {(exercise?.notes || ex.notes) && (
            <p className="mt-1 text-[13px] text-label-2 italic">{[exercise?.notes, ex.notes].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {exercise?.barbell && (
          <button
            type="button"
            onClick={() => onPlates(ex.sets.find((s) => !s.done)?.weight ?? ex.sets[0]?.weight ?? null)}
            className="h-11 shrink-0 rounded-xl bg-card-2 px-3 text-[15px] font-semibold text-accent"
          >
            Dischi
          </button>
        )}
        <button
          type="button"
          aria-label="Opzioni esercizio"
          onClick={onMenu}
          className="size-11 shrink-0 rounded-xl bg-card-2 text-[20px] font-bold text-label-2"
        >
          ···
        </button>
      </div>
      <div className="flex px-4 pb-1 text-[11px] font-semibold text-label-3 uppercase">
        <span className="w-9">Set</span>
        <span className="flex-1">Peso × reps</span>
        <span className="mr-14 w-16 text-right">Ultima</span>
      </div>
      <ul>
        {ex.sets.map((s, si) => {
          const label = s.type === 'normal' || s.type === 'plus' ? String(++workN) : SET_LABEL[s.type]
          const last = lastOf(s)
          const record = s.done ? recordFor(s) : null
          const reps = s.done ? repsDone(s) : null
          const missed = s.done && s.targetReps !== null && reps! < s.targetReps
          return (
            <li key={si} className="border-t-[0.5px] border-sep">
              <div className="flex min-h-14 items-center gap-1 pl-4">
                <span className={`w-8 text-[15px] font-semibold ${s.type === 'warmup' ? 'text-label-3' : 'text-label-2'}`}>
                  {label}
                </span>
                <button type="button" onClick={() => onEdit(si)} className="min-h-14 min-w-0 flex-1 py-1.5 text-left">
                  <span
                    className={`block text-[17px] font-semibold tabular-nums ${s.type === 'warmup' ? 'text-label-2' : ''} ${
                      s.done ? 'text-done' : ''
                    }`}
                  >
                    {weightText(s.weight, loadType)} × {s.done ? reps : targetText(s)}
                    {missed && <span className="text-label-2"> /{s.targetReps}</span>}
                  </span>
                  <span className="block text-[12px] text-label-2">
                    {[
                      s.pct ? `${Math.round(s.pct * 100)}%` : null,
                      s.type === 'plus' ? 'AMRAP' : null,
                      s.rpe ? `RPE ${formatKg(s.rpe)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {record && <span className="ml-1 font-semibold text-accent">★ Record {record.kind === 'e1rm' ? 'e1RM' : 'reps'}</span>}
                  </span>
                </button>
                <span className="w-16 shrink-0 text-right text-[13px] text-label-2 tabular-nums">{last ?? ''}</span>
                <button
                  type="button"
                  aria-label={s.done ? 'Segna come non fatto' : 'Segna come fatto'}
                  onClick={() => onToggle(si)}
                  className="flex size-14 shrink-0 items-center justify-center"
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-full border-2 text-[20px] font-bold ${
                      s.done ? 'border-done bg-done text-black' : 'border-label-3 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </button>
              </div>
              {s.type === 'plus' && s.done && (
                <PlusStepper set={s} e1rm={e1rmFor(s)} onChange={(r) => onPlusReps(si, r)} />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Set "+": reps in più rispetto al target, con e1RM subito. */
function PlusStepper({ set, e1rm, onChange }: { set: SessionSet; e1rm: number; onChange: (reps: number) => void }) {
  const target = set.targetReps ?? 0
  const reps = set.reps ?? target
  const extra = reps - target
  return (
    <div className="flex items-center gap-2 px-4 pb-3">
      <button
        type="button"
        aria-label="Una rep in meno"
        onClick={() => onChange(reps - 1)}
        className="size-12 rounded-xl bg-card-2 text-[26px] leading-none"
      >
        −
      </button>
      <div className="flex-1 text-center">
        <p className="text-[20px] font-bold tabular-nums">
          {extra >= 0 ? `+${extra}` : extra} → {reps} reps
        </p>
        <p className="text-[13px] text-label-2">e1RM {formatKg(Math.round(e1rm * 10) / 10)} kg</p>
      </div>
      <button
        type="button"
        aria-label="Una rep in più"
        onClick={() => onChange(reps + 1)}
        className="size-12 rounded-xl bg-accent text-[26px] leading-none text-black"
      >
        +
      </button>
    </div>
  )
}

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => ({ value: v, label: formatKg(v) }))

function SetEditor({
  session,
  exIdx,
  setIdx,
  exercise,
  step,
  onClose,
  update,
}: {
  session: Session
  exIdx: number
  setIdx: number
  exercise: Exercise | undefined
  step: number
  onClose: () => void
  update: (fn: (s: Session) => void) => Promise<Session | undefined>
}) {
  const set = session.exercises[exIdx]?.sets[setIdx]
  if (!set) return null
  const change = (fn: (s: SessionSet) => void) => void update((s) => fn(s.exercises[exIdx].sets[setIdx]))
  const weightLabel = exercise?.loadType === 'assisted' ? 'Assist.' : exercise?.loadType === 'weighted' ? 'Zavorra' : 'Peso'
  return (
    <Sheet open title={`${exercise?.name ?? 'Set'} · set ${setIdx + 1}`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <Stepper
          label={weightLabel}
          value={set.weight}
          onChange={(v) => change((s) => void (s.weight = v))}
          step={exercise?.increment || step}
          decimal
          suffix="kg"
        />
        <Stepper
          label="Reps"
          value={set.reps ?? set.targetReps}
          onChange={(v) => change((s) => void (s.reps = v))}
          suffix={set.targetReps !== null ? `su ${targetText(set)}` : undefined}
        />
        <div>
          <p className="mb-2 text-[13px] font-semibold text-label-2 uppercase">RPE (facoltativo)</p>
          <Choice options={RPE_OPTIONS} value={set.rpe} onChange={(v) => change((s) => void (s.rpe = v))} allowNone />
        </div>
        <Button
          kind={set.done ? 'secondary' : 'primary'}
          onClick={() => {
            change((s) => {
              s.done = !s.done
              if (s.done && s.reps === null) s.reps = s.targetReps
            })
            onClose()
          }}
        >
          {set.done ? 'Segna come non fatto' : 'Segna come fatto'}
        </Button>
        <Button
          kind="danger"
          onClick={() => {
            void update((s) => void s.exercises[exIdx].sets.splice(setIdx, 1))
            onClose()
          }}
        >
          Elimina questo set
        </Button>
      </div>
    </Sheet>
  )
}

function ExerciseMenu({
  session,
  idx,
  exercise,
  onClose,
  update,
  onReplace,
  onPlates,
}: {
  session: Session
  idx: number
  exercise: Exercise | undefined
  onClose: () => void
  update: (fn: (s: Session) => void) => Promise<Session | undefined>
  onReplace: () => void
  onPlates: () => void
}) {
  const confirm = useConfirm()
  const ex = session.exercises[idx]
  const next = session.exercises[idx + 1]

  const addSet = () =>
    update((s) => {
      const sets = s.exercises[idx].sets
      const model = [...sets].reverse().find((x) => x.type !== 'warmup') ?? sets[sets.length - 1]
      sets.push({
        type: model?.type === 'plus' ? 'joker' : (model?.type ?? 'normal'),
        weight: model?.weight ?? null,
        targetReps: model?.targetReps ?? null,
        reps: null,
        rpe: null,
        done: false,
        pct: model?.type === 'plus' ? undefined : model?.pct,
      })
    })

  const linkSuperset = () =>
    update((s) => {
      const used = new Set(s.exercises.map((e) => e.superset).filter(Boolean))
      const letter = s.exercises[idx].superset ?? 'ABCDEFGH'.split('').find((l) => !used.has(l)) ?? 'Z'
      s.exercises[idx].superset = letter
      s.exercises[idx + 1].superset = letter
    })

  const unlink = () =>
    update((s) => {
      const letter = s.exercises[idx].superset
      s.exercises[idx].superset = null
      const rest = s.exercises.filter((e) => e.superset === letter)
      if (rest.length === 1) rest[0].superset = null
    })

  const move = (dir: -1 | 1) =>
    update((s) => {
      const j = idx + dir
      if (j < 0 || j >= s.exercises.length) return
      ;[s.exercises[idx], s.exercises[j]] = [s.exercises[j], s.exercises[idx]]
    })

  return (
    <Sheet open title={exercise?.name ?? 'Esercizio'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold text-label-2 uppercase">Note su questo esercizio (oggi)</p>
        <TextInput
          value={ex.notes}
          onChange={(notes) => void update((s) => void (s.exercises[idx].notes = notes))}
          placeholder="Es. presa più stretta, dolore alla spalla…"
          multiline
        />
        {exercise?.barbell && (
          <Button kind="secondary" onClick={onPlates}>
            Calcolatore dischi
          </Button>
        )}
        <Button kind="secondary" onClick={() => void addSet()}>
          + Aggiungi un set
        </Button>
        {ex.superset ? (
          <Button kind="secondary" onClick={() => void unlink().then(onClose)}>
            Togli dal superset
          </Button>
        ) : (
          next && (
            <Button kind="secondary" onClick={() => void linkSuperset().then(onClose)}>
              Superset con il successivo
            </Button>
          )
        )}
        <div className="flex gap-3">
          <Button kind="secondary" className="flex-1" disabled={idx === 0} onClick={() => void move(-1).then(onClose)}>
            ↑ Sposta su
          </Button>
          <Button
            kind="secondary"
            className="flex-1"
            disabled={idx === session.exercises.length - 1}
            onClick={() => void move(1).then(onClose)}
          >
            ↓ Sposta giù
          </Button>
        </div>
        <Button kind="secondary" onClick={onReplace}>
          Sostituisci esercizio
        </Button>
        <Button
          kind="danger"
          onClick={() =>
            confirm.ask(`Togliere ${exercise?.name ?? "l'esercizio"} dal workout di oggi?`, 'Togli esercizio', () => {
              void update((s) => void s.exercises.splice(idx, 1))
              onClose()
            })
          }
        >
          Togli dal workout
        </Button>
      </div>
      {confirm.node}
    </Sheet>
  )
}

function FinishSheet({
  session,
  exercises,
  previous,
  recordOpts,
  onClose,
}: {
  session: Session
  exercises: Map<string, Exercise>
  previous: Session[]
  recordOpts: RecordOptions
  onClose: () => void
}) {
  const now = useNow(1000)
  const [rpe, setRpe] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()
  const work = session.exercises.flatMap((e) => e.sets.filter((s) => s.type !== 'warmup'))
  const doneSets = work.filter((s) => s.done).length
  const records = sessionRecords(session, previous, recordOpts)
  const minutes = Math.max(1, Math.round((now - session.startedAt) / 60000))

  const save = async () => {
    setSaving(true)
    const latest = (await db.sessions.get(session.id)) ?? session
    await finishSession(latest, rpe)
    onClose()
  }

  return (
    <Sheet open title="Termina workout" onClose={onClose} doneLabel="Indietro">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Durata" value={`${minutes} min`} />
          <Stat label="Set fatti" value={`${doneSets} / ${work.length}`} />
        </div>
        {doneSets < work.length && (
          <p className="text-[15px] text-label-2">I set non spuntati non verranno contati.</p>
        )}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-label-2 uppercase">Record battuti</p>
          {records.length === 0 ? (
            <p className="text-[15px] text-label-2">Nessun record questa volta.</p>
          ) : (
            <ul className="divide-y divide-sep rounded-xl bg-card">
              {records.map((r) => (
                <li key={`${r.exerciseId}-${r.kind}`} className="px-4 py-3">
                  <p className="font-semibold">
                    <span className="text-accent">★</span> {exercises.get(r.exerciseId)?.name}
                  </p>
                  <p className="text-[15px] text-label-2">
                    {r.kind === 'e1rm'
                      ? `e1RM ${formatKg(Math.round(r.value * 10) / 10)} kg (prima ${formatKg(Math.round(r.previous * 10) / 10)}) con ${formatKg(r.weight)}×${r.reps}`
                      : `${r.reps} reps con ${formatKg(r.weight)} kg (prima ${r.previous})`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-label-2 uppercase">Quanto è stato duro? (RPE 1-10, facoltativo)</p>
          <Choice
            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ({ value: v, label: String(v) }))}
            value={rpe}
            onChange={setRpe}
            allowNone
          />
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          Salva workout
        </Button>
        <Button
          kind="danger"
          onClick={() =>
            confirm.ask('Il workout verrà cancellato e non conterà nello storico.', 'Elimina workout', () => {
              void db.sessions.delete(session.id).then(() => stopRest())
              onClose()
            })
          }
        >
          Elimina workout
        </Button>
      </div>
      {confirm.node}
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="text-[13px] text-label-2">{label}</p>
      <p className="text-[22px] font-bold tabular-nums">{value}</p>
    </div>
  )
}
