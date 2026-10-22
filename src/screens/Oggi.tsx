// Oggi: il programma come una nota. Ciclo → settimane → giorni con il pallino da spuntare.
// Tocchi il pallino per spuntare il giorno, oppure il nome per aprirlo e scrivere le reps serie per serie.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Stepper } from '../components/controls'
import { Chevron, EmptyState, Group, Screen } from '../components/ui'
import { exportBackup } from '../lib/dataio'
import { editSession, ensureDraft, lastSetsByExercise, markDayDone, setTm, unmarkDay } from '../lib/db'
import { formatKg, targetText, weightText } from '../lib/format'
import { useDays, useExercises, useLifts, useSessions, useSettings, useWakeLock } from '../lib/hooks'
import { buildMainSets, positionLabel, slotKey, WEEK_LABEL, weeksOfCycle } from '../lib/program531'
import { planDay, repsDone, type BuildContext } from '../lib/session'
import type { CycleConfig, Day, Exercise, Lift, Position, Session, SessionSet, Settings, WeekKind } from '../lib/types'
import { e1rm } from '../lib/weights'

const BACKUP_DAYS = 14

interface WeekSlot {
  pos: Position
  kind: WeekKind
  state: 'past' | 'current' | 'future'
}

/** Le settimane di un ciclo nell'ordine in cui si fanno, comprese quelle extra. */
function cycleSlots(cfg: CycleConfig, cycle: number, current: Position, sessions: Session[]): WeekSlot[] {
  const weeks = weeksOfCycle(cfg, cycle)
  const list: Position[] = []
  weeks.forEach((_, idx) => {
    const extras = new Set<WeekKind>()
    for (const s of sessions) {
      const [c, w, extra] = s.slot.split(':')
      if (Number(c) === cycle && Number(w) === idx && extra) extras.add(extra as WeekKind)
    }
    if (current.cycle === cycle && current.weekIdx === idx && current.extra) extras.add(current.extra)
    for (const e of extras) list.push({ cycle, weekIdx: idx, extra: e })
    list.push({ cycle, weekIdx: idx, extra: null })
  })
  const curIdx = list.findIndex((p) => slotKey(p) === slotKey(current))
  return list.map((pos, i) => ({
    pos,
    kind: pos.extra ?? weeks[pos.weekIdx],
    state: cycle < current.cycle || (curIdx >= 0 && i < curIdx) ? 'past' : i === curIdx ? 'current' : 'future',
  }))
}

export function Oggi({ onImport }: { onImport: () => void }) {
  const settings = useSettings()
  const days = useDays()
  const lifts = useLifts()
  const exercises = useExercises()
  const sessions = useSessions()
  const [open, setOpen] = useState<{ dayId: string; slot: WeekSlot; hint?: string } | null>(null)
  const listScroll = useRef(0)

  const ctx: BuildContext | null = useMemo(() => {
    if (!settings || !sessions) return null
    const done = sessions.filter((s) => s.status === 'done')
    return { settings, exercises, lifts: new Map(lifts.map((l) => [l.exerciseId, l])), lastSets: lastSetsByExercise(done) }
  }, [settings, exercises, lifts, sessions])
  if (!settings || !days || !sessions || !ctx) return null

  const cfg = settings.cycleConfig
  const pos = settings.position
  const done = sessions.filter((s) => s.status === 'done')
  const bySlot = new Map<string, Session[]>()
  for (const s of sessions) bySlot.set(s.slot, [...(bySlot.get(s.slot) ?? []), s])
  const entryOf = (slot: WeekSlot, dayId: string) => (bySlot.get(slotKey(slot.pos)) ?? []).find((s) => s.dayId === dayId)

  const openDay = (dayId: string, slot: WeekSlot, hint?: string) => {
    listScroll.current = window.scrollY
    setOpen({ dayId, slot, hint })
    window.scrollTo(0, 0)
  }
  const closeDay = () => {
    setOpen(null)
    requestAnimationFrame(() => window.scrollTo(0, listScroll.current))
  }

  const openedDay = open && days.find((d) => d.id === open.dayId)
  if (open && openedDay) {
    return (
      <DayPage
        day={openedDay}
        slot={open.slot}
        entry={entryOf(open.slot, open.dayId)}
        hint={open.hint}
        ctx={ctx}
        backLabel={`Ciclo ${pos.cycle}`}
        onBack={closeDay}
      />
    )
  }

  if (days.length === 0) {
    return (
      <Screen title="Oggi">
        <Group>
          <EmptyState title="Nessun programma" text="Carica il programma preparato con Claude, oppure crealo a mano nella scheda Programma." />
          <div className="px-4 pb-4">
            <Button className="w-full" onClick={onImport}>
              Importa da Claude
            </Button>
          </div>
        </Group>
      </Screen>
    )
  }

  /** Pallino del giorno: spunta o toglie la spunta, come nelle Note. */
  const toggleDay = async (day: Day, slot: WeekSlot) => {
    const entry = entryOf(slot, day.id)
    if (entry?.status === 'done') {
      if (!(await unmarkDay(entry))) openDay(day.id, slot, 'Non si può più togliere la spunta: nella settimana dopo hai già fatto un allenamento.')
      return
    }
    if (slot.state !== 'current') return openDay(day.id, slot)
    if ((await markDayDone(day)) === 'missing-plus') openDay(day.id, slot, 'Scrivi quante reps hai fatto nel set «+»: servono per il nuovo TM.')
  }

  const renderCycle = (cycle: number) =>
    cycleSlots(cfg, cycle, pos, sessions).map((slot) => {
      const inSlot = bySlot.get(slotKey(slot.pos)) ?? []
      // Settimane passate senza niente di spuntato (es. saltate o prima dell'inizio): non servono.
      if (slot.state === 'past' && !inSlot.some((s) => s.status === 'done')) return null
      const firstOpen = slot.state === 'current' ? days.find((d) => !inSlot.some((s) => s.dayId === d.id && s.status === 'done')) : undefined
      return (
        <Group key={slotKey(slot.pos)} header={`${WEEK_LABEL[slot.kind]}${slot.pos.extra ? ' extra' : ''}${slot.state === 'current' ? ' · questa settimana' : ''}`}>
          {days.map((d) => (
            <DayRow
              key={d.id}
              day={d}
              summary={mainSummary(d, slot.kind, ctx)}
              entry={inSlot.find((s) => s.dayId === d.id)}
              next={firstOpen?.id === d.id}
              dim={slot.state === 'future'}
              onOpen={() => openDay(d.id, slot)}
              onToggle={() => void toggleDay(d, slot)}
            />
          ))}
        </Group>
      )
    })

  const pending = lifts.filter((l) => l.pendingTm)
  const backupDue = done.length > 0 && (settings.lastBackupAt === null || Date.now() - settings.lastBackupAt > BACKUP_DAYS * 86_400_000)
  const tmLine = lifts.map((l) => `${exercises.get(l.exerciseId)?.name ?? '?'} ${formatKg(l.tm)}`).join(' · ')

  return (
    <Screen title={`Ciclo ${pos.cycle}`} subtitle={tmLine ? `TM ${tmLine}` : undefined}>
      {pending.map((l) => (
        <TmProposal key={l.exerciseId} lift={l} exercise={exercises.get(l.exerciseId)} settings={settings} />
      ))}

      {renderCycle(pos.cycle)}

      <h2 className="px-4 pt-2 text-[22px] font-bold text-label-2">Ciclo {pos.cycle + 1}</h2>
      {renderCycle(pos.cycle + 1)}

      {/* Appena finito un ciclo resta visibile, per poter togliere una spunta messa per sbaglio. */}
      {pos.cycle > 1 && !done.some((s) => s.cycle === pos.cycle) && done.some((s) => s.cycle === pos.cycle - 1) && (
        <>
          <h2 className="px-4 pt-2 text-[22px] font-bold text-label-2">Ciclo {pos.cycle - 1} · finito</h2>
          {renderCycle(pos.cycle - 1)}
        </>
      )}

      {backupDue && <BackupReminder last={settings.lastBackupAt} />}
    </Screen>
  )
}

/** Pallino come nelle Note: vuoto, oppure giallo con la spunta. */
function Check({ done, highlight = false, size = 26 }: { done: boolean; highlight?: boolean; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${
        done ? 'bg-accent text-black' : `border-[1.5px] ${highlight ? 'border-accent' : 'border-label-3'}`
      }`}
      style={{ width: size, height: size }}
    >
      {done && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 7.5 5.5 10.5 11.5 3.5" />
        </svg>
      )}
    </span>
  )
}

function DayRow({
  day,
  summary,
  entry,
  next,
  dim,
  onOpen,
  onToggle,
}: {
  day: Day
  summary: string
  entry: Session | undefined
  next: boolean
  dim: boolean
  onOpen: () => void
  onToggle: () => void
}) {
  const done = entry?.status === 'done'
  const work = entry ? entry.exercises.flatMap((e) => e.sets.filter((s) => s.type !== 'warmup')) : []
  const progress = entry && !done && work.some((s) => s.done) ? `in corso · ${work.filter((s) => s.done).length}/${work.length} serie` : null
  return (
    <div className="flex items-stretch pl-1 [&:first-child>div]:border-t-0">
      <button type="button" onClick={onToggle} aria-label={done ? `Togli la spunta a ${day.name}` : `Spunta ${day.name}`} className="flex w-12 shrink-0 items-center justify-center">
        <Check done={done} highlight={next} />
      </button>
      <button type="button" onClick={onOpen} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 border-t-[0.5px] border-sep py-2.5 pr-4 text-left active:opacity-60">
        <span className={`min-w-0 flex-1 ${dim ? 'opacity-55' : ''}`}>
          <span className={`block text-[17px] ${done ? 'text-label-2' : ''}`}>{day.name}</span>
          {(progress || summary) && <span className={`block truncate text-[13px] ${progress ? 'text-accent' : 'text-label-2'}`}>{progress ?? summary}</span>}
        </span>
        <span className="text-label-3">
          <Chevron direction="right" small />
        </span>
      </button>
    </div>
  )
}

/** "Panca 70×5 / 77,5×3 / 87,5×1+" per i principali del giorno in quella settimana. */
function mainSummary(day: Day, kind: WeekKind, ctx: BuildContext): string {
  return day.exercises
    .filter((pe) => pe.role === 'main531')
    .map((pe) => {
      const lift = ctx.lifts.get(pe.exerciseId)
      if (!lift) return ''
      const work = buildMainSets(lift, ctx.settings, kind).filter((s) => s.type !== 'warmup' && s.type !== 'fsl')
      const name = ctx.exercises.get(pe.exerciseId)?.name.split(' ')[0] ?? ''
      return `${name} ${work.map((s) => `${formatKg(s.weight ?? 0)}×${targetText(s)}`).join(' / ')}`
    })
    .filter(Boolean)
    .join(' · ')
}

/** La pagina di un giorno: come una nota, una riga per serie con le reps da scrivere. */
function DayPage({
  day,
  slot,
  entry,
  hint,
  ctx,
  backLabel,
  onBack,
}: {
  day: Day
  slot: WeekSlot
  entry: Session | undefined
  hint?: string
  ctx: BuildContext
  backLabel: string
  onBack: () => void
}) {
  const done = entry?.status === 'done'
  const editable = slot.state === 'current' && !done
  const plan = entry?.exercises ?? planDay(day, ctx, slot.pos)
  const [message, setMessage] = useState<string | null>(hint ?? null)
  const [busy, setBusy] = useState(false)
  // In palestra con il giorno aperto lo schermo resta acceso.
  useWakeLock(editable)

  // Il giorno in corso si crea solo alla prima modifica (aprirlo per guardare non lo "inizia").
  const draftId = useRef<Promise<string> | null>(entry ? Promise.resolve(entry.id) : null)
  useEffect(() => {
    if (entry) draftId.current = Promise.resolve(entry.id)
  }, [entry])
  const edit = async (fn: (s: Session) => void) => {
    if (!editable) return
    draftId.current ??= ensureDraft(day)
    await editSession(await draftId.current, fn)
  }

  const finish = async () => {
    setBusy(true)
    const result = await markDayDone(day)
    setBusy(false)
    if (result === 'missing-plus') setMessage('Scrivi quante reps hai fatto nel set «+»: servono per il nuovo TM.')
    else onBack()
  }

  return (
    <Screen title={day.name} subtitle={positionLabel(ctx.settings.cycleConfig, slot.pos)} back={{ label: backLabel, onClick: onBack }}>
      {plan.map((ex, exIdx) => {
        const exercise = ctx.exercises.get(ex.exerciseId)
        const warmup = ex.sets.filter((s) => s.type === 'warmup')
        let n = 0
        return (
          <div key={ex.key}>
            <div className="flex items-end justify-between gap-3 px-5 pb-1.5">
              <div className="min-w-0">
                <h2 className="text-[20px] leading-tight font-bold">
                  {ex.superset && <span className="mr-1.5 text-[15px] text-accent">{ex.superset}</span>}
                  {exercise?.name ?? '?'}
                </h2>
                {exercise?.notes && <p className="text-[13px] text-label-2">{exercise.notes}</p>}
                {warmup.length > 0 && (
                  <p className="text-[13px] text-label-2">Riscaldamento {warmup.map((s) => `${formatKg(s.weight ?? 0)}×${s.targetReps}`).join(' · ')}</p>
                )}
              </div>
            </div>
            <div className="mx-4 overflow-hidden rounded-[20px] bg-card">
              {ex.sets.map((set, setIdx) => {
                if (set.type === 'warmup') return null
                const label = set.type === 'fsl' ? 'FSL' : String(++n)
                const update = (fn: (s: SessionSet, all: SessionSet[]) => void) =>
                  void edit((s) => {
                    const sets = s.exercises[exIdx]?.sets
                    if (sets?.[setIdx]) fn(sets[setIdx], sets)
                  })
                return (
                  <SetLine
                    key={setIdx}
                    label={label}
                    set={set}
                    loadType={exercise?.loadType ?? 'normal'}
                    editable={editable}
                    weightEditable={ex.role === 'accessory'}
                    bonus={ctx.settings.plusRepsBonus}
                    onToggle={() =>
                      update((s) => {
                        s.done = !s.done
                        s.reps = s.done ? (s.reps ?? s.targetReps) : null
                      })
                    }
                    onReps={(v) =>
                      update((s) => {
                        s.reps = v
                        s.done = v !== null
                      })
                    }
                    onWeight={(v) =>
                      update((s, all) => {
                        // Il nuovo peso vale anche per le serie dopo, non ancora fatte, che avevano lo stesso peso.
                        const old = s.weight
                        s.weight = v
                        for (const later of all.slice(setIdx + 1)) if (!later.done && later.weight === old) later.weight = v
                      })
                    }
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="px-4">
        <p className="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Note</p>
        <NoteField value={entry?.notes ?? ''} editable={slot.state === 'current'} onChange={(notes) => void edit((s) => void (s.notes = notes))} />
      </div>

      <div className="flex flex-col gap-3 px-4">
        {message && <p className="text-center text-[15px] text-danger">{message}</p>}
        {done ? (
          <>
            <p className="text-center text-[15px] text-label-2">
              ✓ Fatto {new Date(entry!.endedAt ?? entry!.startedAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <Button
              kind="secondary"
              onClick={async () => {
                if (await unmarkDay(entry!)) setMessage(null)
                else setMessage('Non si può più togliere la spunta: nella settimana dopo hai già fatto un allenamento.')
              }}
            >
              Togli la spunta
            </Button>
          </>
        ) : editable ? (
          <Button onClick={() => void finish()} disabled={busy}>
            Fatto ✓
          </Button>
        ) : (
          <p className="text-center text-[15px] text-label-2">
            {slot.state === 'future' ? 'Questa settimana non è ancora arrivata: qui vedi cosa ci sarà da fare.' : 'Settimana passata: questo giorno non è stato fatto.'}
          </p>
        )}
      </div>
    </Screen>
  )
}

/**
 * Una serie come riga di una nota: «○  1   65 kg × 3». Il 3 è opaco (il target) finché non confermi:
 * tocchi il pallino e vale il target, tocchi il numero e ne scrivi un altro.
 */
function SetLine({
  label,
  set,
  loadType,
  editable,
  weightEditable,
  bonus,
  onToggle,
  onReps,
  onWeight,
}: {
  label: string
  set: SessionSet
  loadType: Exercise['loadType']
  editable: boolean
  weightEditable: boolean
  bonus: number
  onToggle: () => void
  onReps: (v: number | null) => void
  onWeight: (v: number | null) => void
}) {
  const plus = set.type === 'plus'
  const base = set.targetReps ?? 0
  const est = plus && set.reps !== null && set.weight ? e1rm(set.weight, set.reps + bonus) : 0
  const prefix = loadType === 'assisted' ? 'assist. ' : loadType === 'weighted' ? '+' : ''
  return (
    <div className="flex min-h-[52px] items-center gap-2 pl-3 select-none [&+&]:border-t-[0.5px] [&+&]:border-sep">
      <button
        type="button"
        disabled={!editable}
        onClick={onToggle}
        aria-label={set.done ? 'Segna come non fatta' : 'Segna come fatta'}
        className="flex size-11 shrink-0 items-center justify-center disabled:opacity-60"
      >
        <Check done={set.done} />
      </button>
      <span className="w-9 shrink-0 text-[15px] text-label-2">{label}</span>
      <span className="flex min-w-0 flex-1 flex-col py-1.5">
        <span className="flex items-baseline text-[19px] tabular-nums">
          {weightEditable && editable ? (
            <>
              {prefix && <span className="mr-1">{prefix.trim()}</span>}
              <NumInput value={set.weight} onChange={onWeight} decimal placeholder="—" autoWidth className="rounded-md px-0.5 text-left" />
              <span className="ml-1">kg</span>
            </>
          ) : (
            <span>{weightText(set.weight, loadType)}</span>
          )}
          <span className="mx-2 text-label-3">×</span>
          {plus ? (
            // Set "+": la base resta (5+) e si scrivono le reps in più, come nella nota: 5+3 = 8.
            <>
              <span className={set.done ? 'font-semibold' : 'text-label-2'}>{base}+</span>
              {editable ? (
                <NumInput
                  value={set.reps === null ? null : Math.max(0, set.reps - base)}
                  onChange={(extra) => onReps(extra === null ? null : base + extra)}
                  placeholder="0"
                  autoWidth
                  ariaLabel="Reps in più"
                  className="min-w-[2ch] rounded-md px-0 text-left font-semibold"
                />
              ) : (
                set.done && <span className="font-semibold">{Math.max(0, repsDone(set) - base)}</span>
              )}
            </>
          ) : editable ? (
            <NumInput
              value={set.reps}
              onChange={onReps}
              placeholder={targetText(set)}
              autoWidth
              ariaLabel="Reps fatte"
              className="min-w-[2.2ch] rounded-md px-1 text-left font-semibold"
            />
          ) : (
            <span className={set.done ? 'font-semibold' : 'text-label-3'}>{set.done ? repsDone(set) : targetText(set)}</span>
          )}
        </span>
        {est > 0 && (
          <span className="text-[12px] text-label-2">
            {set.reps} reps · e1RM {formatKg(Math.round(est * 10) / 10)} kg
          </span>
        )}
      </span>
    </div>
  )
}

/** Numero scritto come in una nota: niente riquadri, tastierino numerico, si salva mentre scrivi. */
function NumInput({
  value,
  onChange,
  placeholder,
  decimal = false,
  className = '',
  ariaLabel,
  autoWidth = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  decimal?: boolean
  className?: string
  ariaLabel?: string
  /** Largo quanto il numero scritto, come testo in una nota. */
  autoWidth?: boolean
}) {
  const [text, setText] = useState(value === null ? '' : formatKg(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value === null ? '' : formatKg(value))
  }, [value])
  return (
    <input
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(value === null ? '' : formatKg(value))
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const n = parseFloat(raw.replace(',', '.'))
        if (raw.trim() === '') onChange(null)
        else if (Number.isFinite(n) && n >= 0) onChange(n)
      }}
      style={autoWidth ? { width: `calc(${Math.max(text.length || (placeholder?.length ?? 1), 1) + 0.3}ch + 10px)` } : undefined}
      className={`bg-transparent tabular-nums outline-none placeholder:text-label-3 focus:ring-2 focus:ring-accent ${className}`}
    />
  )
}

function NoteField({ value, editable, onChange }: { value: string; editable: boolean; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <textarea
      value={text}
      readOnly={!editable}
      onChange={(e) => {
        setText(e.target.value)
        onChange(e.target.value)
      }}
      placeholder={editable ? 'Come è andata, sensazioni, dolori…' : ''}
      rows={3}
      className="w-full rounded-[20px] bg-card px-4 py-3 text-[17px] outline-none placeholder:text-label-3"
    />
  )
}

function TmProposal({ lift, exercise, settings }: { lift: Lift; exercise: Exercise | undefined; settings: Settings }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<number | null>(lift.pendingTm?.proposed ?? lift.tm)
  const p = lift.pendingTm!
  const confirm = (tm: number) => void setTm(lift.exerciseId, tm, `Fine ciclo: ${p.reason}`)
  return (
    <Group header="Nuovo Training Max">
      <div className="px-4 py-3">
        <p className="font-semibold">{exercise?.name}</p>
        <p className="text-[15px] text-label-2">{p.reason}</p>
        <p className="mt-1 text-[15px]">
          TM {formatKg(lift.tm)} → <span className="font-bold text-accent">{formatKg(p.proposed)} kg</span>
        </p>
        {editing ? (
          <div className="mt-3 flex flex-col gap-3">
            <Stepper value={value} onChange={setValue} step={settings.roundingStep} decimal suffix="kg" />
            <Button onClick={() => value && confirm(value)} disabled={!value}>
              Salva {value ? `${formatKg(value)} kg` : ''}
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={() => confirm(p.proposed)}>
              Conferma
            </Button>
            <Button kind="secondary" className="flex-1" onClick={() => setEditing(true)}>
              Modifica
            </Button>
          </div>
        )}
      </div>
    </Group>
  )
}

function BackupReminder({ last }: { last: number | null }) {
  const [busy, setBusy] = useState(false)
  const days = last ? Math.floor((Date.now() - last) / 86_400_000) : null
  return (
    <Group footer={`${days === null ? 'Non hai ancora salvato una copia dei dati.' : `Ultimo backup ${days} giorni fa.`} Salvala in File (iCloud Drive).`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void exportBackup().finally(() => setBusy(false))
        }}
        className="block min-h-11 w-full px-4 text-left text-[17px] text-accent active:opacity-50"
      >
        Fai il backup
      </button>
    </Group>
  )
}
