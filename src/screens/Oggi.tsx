// Oggi: workout in corso, oppure il prossimo giorno del programma da iniziare.
import { useState } from 'react'
import { Button, Sheet, Stepper } from '../components/controls'
import { EmptyState, Group, Screen } from '../components/ui'
import { buildContext, db, setTm } from '../lib/db'
import { exportBackup } from '../lib/dataio'
import { formatDateLong, formatKg } from '../lib/format'
import { useActiveSession, useDays, useDoneSessions, useExercises, useLifts, useSettings } from '../lib/hooks'
import { buildMainSets, positionLabel } from '../lib/program531'
import { buildSession } from '../lib/session'
import type { Day, Exercise, Lift, Settings } from '../lib/types'
import { Workout } from './Workout'

const BACKUP_DAYS = 14

export function Oggi({ onImport }: { onImport: () => void }) {
  const settings = useSettings()
  const active = useActiveSession()
  const days = useDays()
  const lifts = useLifts()
  const exercises = useExercises()
  const done = useDoneSessions()
  const [today] = useState(() => new Date())
  const [picking, setPicking] = useState(false)
  const [starting, setStarting] = useState(false)

  if (!settings || active === undefined || !days) return null
  if (active) return <Workout session={active} settings={settings} />

  const start = async (day: Day) => {
    if (starting) return
    setStarting(true)
    try {
      const ctx = await buildContext()
      await db.sessions.add(buildSession(day, ctx))
      window.scrollTo(0, 0)
    } finally {
      setStarting(false)
      setPicking(false)
    }
  }

  const next = days[Math.min(settings.nextDayIdx, days.length - 1)]
  const doneToday = (done ?? []).filter((s) => new Date(s.startedAt).toDateString() === today.toDateString())
  const pending = lifts.filter((l) => l.pendingTm)
  const backupDue =
    (done?.length ?? 0) > 0 &&
    (settings.lastBackupAt === null || Date.now() - settings.lastBackupAt > BACKUP_DAYS * 86_400_000)

  return (
    <Screen title="Oggi" subtitle={formatDateLong(today)}>
      {backupDue && <BackupReminder last={settings.lastBackupAt} />}

      {pending.map((l) => (
        <TmProposal key={l.exerciseId} lift={l} exercise={exercises.get(l.exerciseId)} settings={settings} />
      ))}

      {doneToday.length > 0 && (
        <Group>
          {doneToday.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-done font-bold text-black">✓</span>
              <span>
                <span className="block font-semibold">Completato: {s.dayName}</span>
                <span className="text-[13px] text-label-2">
                  {s.endedAt ? `${Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))} min` : ''}
                </span>
              </span>
            </div>
          ))}
        </Group>
      )}

      {!next ? (
        <Group>
          <EmptyState
            title="Nessun programma"
            text="Carica il programma preparato con Claude, oppure crealo a mano nella scheda Programma."
          />
          <div className="px-4 pb-4">
            <Button className="w-full" onClick={onImport}>
              Importa da Claude
            </Button>
          </div>
        </Group>
      ) : (
        <>
          <Group header={`Prossimo allenamento · microciclo ${settings.microcycle}`}>
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-[22px] font-bold">{next.name}</h2>
            </div>
            <ul className="pb-2">
              {next.exercises.map((pe, i) => (
                <PlannedLine key={i} exercise={exercises.get(pe.exerciseId)} pe={pe} lift={lifts.find((l) => l.exerciseId === pe.exerciseId)} settings={settings} />
              ))}
              {next.exercises.length === 0 && <li className="px-4 py-2 text-label-2">Nessun esercizio in questo giorno.</li>}
            </ul>
          </Group>
          <div className="flex flex-col gap-2 px-4">
            <Button onClick={() => void start(next)} disabled={starting}>
              Inizia allenamento
            </Button>
            {days.length > 1 && (
              <Button kind="plain" onClick={() => setPicking(true)}>
                Fai un altro giorno
              </Button>
            )}
          </div>
        </>
      )}

      <Sheet open={picking} title="Quale giorno?" onClose={() => setPicking(false)} doneLabel="Annulla">
        <div className="divide-y divide-sep overflow-hidden rounded-xl bg-card">
          {days.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => void start(d)}
              className="block min-h-12 w-full px-4 py-3 text-left active:bg-card-2"
            >
              {d.name}
              {i === settings.nextDayIdx && <span className="ml-2 text-[13px] text-accent">prossimo</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  )
}

function PlannedLine({
  exercise,
  pe,
  lift,
  settings,
}: {
  exercise: Exercise | undefined
  pe: Day['exercises'][number]
  lift: Lift | undefined
  settings: Settings
}) {
  let detail: string
  if (pe.role === 'main531' && lift) {
    const top = buildMainSets(lift, settings).filter((s) => s.type !== 'warmup' && s.type !== 'fsl').pop()
    detail = `${positionLabel(lift)}${top ? ` · fino a ${formatKg(top.weight ?? 0)}×${top.targetReps}${top.type === 'plus' ? '+' : ''}` : ''}`
  } else {
    const todo = pe.sets == null || (pe.reps == null && pe.repMax == null)
    detail = todo ? 'da completare' : `${pe.sets}×${pe.reps ?? pe.repMax}${pe.weight != null ? ` · ${formatKg(pe.weight)} kg` : ''}`
  }
  return (
    <li className="flex items-baseline justify-between gap-3 px-4 py-1.5">
      <span className={pe.role === 'main531' ? 'font-semibold' : ''}>
        {pe.superset && <span className="mr-1 text-[13px] font-semibold text-accent">{pe.superset}</span>}
        {exercise?.name ?? '?'}
      </span>
      <span className="shrink-0 text-right text-[13px] text-label-2">{detail}</span>
    </li>
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
        <p className="text-[13px] text-label-2">Prossima settimana: {positionLabel(lift)}</p>
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
        {days === null ? 'Non hai ancora mai salvato una copia dei dati.' : `L'ultimo backup è di ${days} giorni fa.`} Se il
        telefono si rompe o iOS cancella i dati, il backup è l'unico modo per recuperarli. Salvalo in File (iCloud Drive).
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
