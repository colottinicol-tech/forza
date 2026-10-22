// Oggi: il programma come una nota. Ciclo → settimane → giorni da spuntare.
// Tocchi un giorno, vedi cosa fare, alla fine "Fatto".
import { useMemo, useState } from 'react'
import { Button, Sheet, Stepper } from '../components/controls'
import { PlateCalculator } from '../components/PlateCalculator'
import { EmptyState, Group, Screen } from '../components/ui'
import { exportBackup } from '../lib/dataio'
import { lastSetsByExercise, markDayDone, setTm, unmarkDay } from '../lib/db'
import { formatKg, targetText, weightText } from '../lib/format'
import { useDays, useDoneSessions, useExercises, useLifts, useSettings, useWakeLock } from '../lib/hooks'
import { buildMainSets, positionLabel, slotKey, WEEK_LABEL, weeksOfCycle } from '../lib/program531'
import { planDay, plusSets, repsDone, type BuildContext } from '../lib/session'
import type { CycleConfig, Day, Exercise, Lift, Position, Session, SessionExercise, Settings, WeekKind } from '../lib/types'

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
  const done = useDoneSessions()
  const [open, setOpen] = useState<{ day: Day; slot: WeekSlot } | null>(null)

  const ctx: BuildContext | null = useMemo(
    () =>
      settings && done
        ? { settings, exercises, lifts: new Map(lifts.map((l) => [l.exerciseId, l])), lastSets: lastSetsByExercise(done) }
        : null,
    [settings, exercises, lifts, done],
  )
  if (!settings || !days || !done || !ctx) return null

  const cfg = settings.cycleConfig
  const pos = settings.position
  const bySlot = new Map<string, Session[]>()
  for (const s of done) bySlot.set(s.slot, [...(bySlot.get(s.slot) ?? []), s])
  const pending = lifts.filter((l) => l.pendingTm)
  const backupDue =
    done.length > 0 && (settings.lastBackupAt === null || Date.now() - settings.lastBackupAt > BACKUP_DAYS * 86_400_000)
  const tmLine = lifts.map((l) => `${exercises.get(l.exerciseId)?.name ?? '?'} ${formatKg(l.tm)}`).join(' · ')

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

  const renderCycle = (cycle: number) =>
    cycleSlots(cfg, cycle, pos, done).map((slot) => {
      const sessions = bySlot.get(slotKey(slot.pos)) ?? []
      // Settimane passate senza niente di spuntato (es. saltate o prima dell'inizio): non servono.
      if (slot.state === 'past' && sessions.length === 0) return null
      const firstOpen = slot.state === 'current' ? days.find((d) => !sessions.some((s) => s.dayId === d.id)) : undefined
      return (
        <Group
          key={slotKey(slot.pos)}
          header={`${WEEK_LABEL[slot.kind]}${slot.pos.extra ? ' extra' : ''}${slot.state === 'current' ? ' · questa settimana' : ''}`}
        >
          {days.map((d) => (
            <DayRow
              key={d.id}
              day={d}
              summary={mainSummary(d, slot.kind, ctx)}
              done={sessions.some((s) => s.dayId === d.id)}
              next={firstOpen?.id === d.id}
              dim={slot.state === 'future'}
              onClick={() => setOpen({ day: d, slot })}
            />
          ))}
        </Group>
      )
    })

  return (
    <Screen title={`Ciclo ${pos.cycle}`} subtitle={tmLine ? `TM ${tmLine}` : undefined}>
      {backupDue && <BackupReminder last={settings.lastBackupAt} />}
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

      {open && (
        <DaySheet
          day={open.day}
          slot={open.slot}
          session={(bySlot.get(slotKey(open.slot.pos)) ?? []).find((s) => s.dayId === open.day.id)}
          ctx={ctx}
          onClose={() => setOpen(null)}
        />
      )}
    </Screen>
  )
}

/** Riga di un giorno: pallino come nelle Note, nome, pesi principali della settimana. */
function DayRow({
  day,
  summary,
  done,
  next,
  dim,
  onClick,
}: {
  day: Day
  summary: string
  done: boolean
  next: boolean
  dim: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0">
      <div className="flex min-h-14 items-center gap-3 border-t-[0.5px] border-sep py-2.5 pr-4">
        <span
          aria-label={done ? 'fatto' : 'da fare'}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
            done ? 'bg-done text-black' : `border-2 ${next ? 'border-accent' : 'border-label-3'}`
          }`}
        >
          {done ? '✓' : ''}
        </span>
        <span className={`min-w-0 flex-1 ${dim ? 'opacity-60' : ''}`}>
          <span className={`block text-[17px] ${done ? 'text-label-2' : 'font-semibold'}`}>{day.name}</span>
          {summary && <span className="block truncate text-[13px] text-label-2">{summary}</span>}
        </span>
        {next && <span className="shrink-0 text-[13px] font-semibold text-accent">prossimo</span>}
        <span className="text-label-3">›</span>
      </div>
    </button>
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

function DaySheet({
  day,
  slot,
  session,
  ctx,
  onClose,
}: {
  day: Day
  slot: WeekSlot
  session: Session | undefined
  ctx: BuildContext
  onClose: () => void
}) {
  const plan = session?.exercises ?? planDay(day, ctx, slot.pos)
  const plus = plusSets(plan)
  const [asking, setAsking] = useState(false)
  const [reps, setReps] = useState<Map<string, number>>(() => new Map(plus.map((p) => [p.exerciseId, p.target])))
  const [plates, setPlates] = useState<number | null | undefined>(undefined)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const name = (id: string) => ctx.exercises.get(id)?.name ?? '?'
  // In palestra con il giorno aperto lo schermo resta acceso.
  useWakeLock(true)

  const finish = async (plusReps: Map<string, number>) => {
    setBusy(true)
    await markDayDone(day, plusReps)
    onClose()
  }

  return (
    <Sheet open title={day.name} onClose={onClose} doneLabel="Chiudi">
      <p className="-mt-1 mb-3 text-[15px] text-label-2">{positionLabel(ctx.settings.cycleConfig, slot.pos)}</p>

      {!asking ? (
        <div className="flex flex-col gap-3">
          {plan.map((ex) => (
            <PlanItem key={ex.key} ex={ex} exercise={ctx.exercises.get(ex.exerciseId)} doneSession={Boolean(session)} onPlates={setPlates} />
          ))}

          <div className="mt-2">
            {session ? (
              <>
                <p className="mb-3 text-center text-[15px] text-done">
                  ✓ Fatto {new Date(session.startedAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <Button
                  kind="secondary"
                  className="w-full"
                  onClick={async () => {
                    if (await unmarkDay(session)) onClose()
                    else setMessage('Non si può più togliere la spunta: nella settimana dopo hai già fatto un allenamento.')
                  }}
                >
                  Togli la spunta
                </Button>
              </>
            ) : slot.state === 'current' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => (plus.length ? setAsking(true) : void finish(new Map()))}
                className="min-h-14 w-full rounded-2xl bg-done text-[19px] font-bold text-black active:opacity-70"
              >
                Fatto ✓
              </button>
            ) : (
              <p className="text-center text-[15px] text-label-2">
                {slot.state === 'future'
                  ? 'Questa settimana non è ancora arrivata: qui vedi cosa ci sarà da fare.'
                  : 'Settimana passata: questo giorno non è stato fatto.'}
              </p>
            )}
            {message && <p className="mt-3 text-center text-[15px] text-danger">{message}</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[17px]">Quante reps hai fatto nel set «+»? Servono per il nuovo TM a fine ciclo.</p>
          {plus.map((p) => (
            <div key={p.exerciseId}>
              <p className="mb-2 font-semibold">
                {name(p.exerciseId)} · {formatKg(p.weight ?? 0)} kg × {p.target}+
              </p>
              <Stepper
                value={reps.get(p.exerciseId) ?? p.target}
                onChange={(v) => setReps((m) => new Map(m).set(p.exerciseId, v ?? 0))}
                suffix="reps"
                max={50}
              />
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish(reps)}
            className="min-h-14 w-full rounded-2xl bg-done text-[19px] font-bold text-black active:opacity-70"
          >
            Salva ✓
          </button>
          <Button kind="plain" onClick={() => setAsking(false)}>
            Indietro
          </Button>
        </div>
      )}
      <PlateCalculator open={plates !== undefined} onClose={() => setPlates(undefined)} initial={plates ?? null} settings={ctx.settings} />
    </Sheet>
  )
}

/** Un esercizio del giorno, scritto come nella nota. */
function PlanItem({
  ex,
  exercise,
  doneSession,
  onPlates,
}: {
  ex: SessionExercise
  exercise: Exercise | undefined
  doneSession: boolean
  onPlates: (w: number | null) => void
}) {
  const warmup = ex.sets.filter((s) => s.type === 'warmup')
  const work = ex.sets.filter((s) => s.type !== 'warmup' && s.type !== 'fsl')
  const fsl = ex.sets.filter((s) => s.type === 'fsl')
  const repsOf = (s: SessionExercise['sets'][number]) => (doneSession && s.type === 'plus' ? String(repsDone(s)) : targetText(s))

  return (
    <div className="rounded-xl bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold">
            {ex.superset && <span className="mr-1 text-[13px] text-accent">{ex.superset}</span>}
            {exercise?.name ?? '?'}
          </p>
          {exercise?.notes && <p className="text-[13px] text-label-2">{exercise.notes}</p>}
        </div>
        {exercise?.barbell && (
          <button
            type="button"
            onClick={() => onPlates((work[work.length - 1] ?? ex.sets[0])?.weight ?? null)}
            className="h-10 shrink-0 rounded-xl bg-card-2 px-3 text-[15px] font-semibold text-accent"
          >
            Dischi
          </button>
        )}
      </div>

      {ex.role === 'main531' ? (
        <div className="mt-1.5 flex flex-col gap-0.5 tabular-nums">
          {warmup.length > 0 && (
            <p className="text-[13px] text-label-2">Riscaldamento: {warmup.map((s) => `${formatKg(s.weight ?? 0)}×${s.targetReps}`).join(' · ')}</p>
          )}
          <p className="text-[19px] font-semibold">{work.map((s) => `${formatKg(s.weight ?? 0)}×${repsOf(s)}`).join(' / ')}</p>
          {fsl.length > 0 && (
            <p className="text-[15px]">
              FSL {formatKg(fsl[0].weight ?? 0)} {fsl.length}×{fsl[0].targetReps}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[17px] tabular-nums">
          {ex.sets.length}×{ex.sets[0]?.targetReps ?? '?'} ·{' '}
          {ex.sets[0]?.weight == null ? (
            <span className="text-accent">peso da completare</span>
          ) : (
            weightText(ex.sets[0].weight, exercise?.loadType)
          )}
        </p>
      )}
    </div>
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
    <div className="mx-4 rounded-[12px] border border-accent/40 bg-card p-4">
      <p className="font-semibold">È ora di fare un backup</p>
      <p className="mt-1 text-[15px] text-label-2">
        {days === null ? 'Non hai ancora mai salvato una copia dei dati.' : `L'ultimo backup è di ${days} giorni fa.`} Salvalo in
        File (iCloud Drive): se il telefono si rompe è l'unico modo per recuperare i dati.
      </p>
      <Button
        className="mt-3 w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void exportBackup().finally(() => setBusy(false))
        }}
      >
        Fai il backup ora
      </Button>
    </div>
  )
}
