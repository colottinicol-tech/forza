// Storico: posizione nei cicli, calendario con i giorni completati, elenco e dettaglio delle sessioni.
import { useState } from 'react'
import { Button, Sheet, useConfirm } from '../components/controls'
import { EmptyState, Group, Row, Screen } from '../components/ui'
import { db } from '../lib/db'
import { formatKg } from '../lib/format'
import { useDoneSessions, useExercises, useLifts } from '../lib/hooks'
import { positionLabel, WEEK_LABEL } from '../lib/program531'
import { repsDone } from '../lib/session'
import type { Exercise, Session } from '../lib/types'
import { targetText, weightText } from './Workout'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function Storico() {
  const sessions = useDoneSessions()
  const lifts = useLifts()
  const exercises = useExercises()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState<Session | null>(null)
  if (!sessions) return null

  const doneDays = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))))
  const inMonth = sessions.filter((s) => {
    const d = new Date(s.startedAt)
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
  })

  return (
    <Screen title="Storico">
      {lifts.length > 0 && (
        <Group header="Posizione nei cicli">
          {lifts.map((l) => (
            <Row key={l.exerciseId} title={exercises.get(l.exerciseId)?.name ?? l.exerciseId} detail={positionLabel(l)} />
          ))}
        </Group>
      )}

      <Group>
        <Calendar month={month} setMonth={setMonth} doneDays={doneDays} />
      </Group>

      <Group header={`${month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })} · ${inMonth.length} ${inMonth.length === 1 ? 'allenamento' : 'allenamenti'}`}>
        {inMonth.length === 0 ? (
          <EmptyState title="Nessun allenamento" text="Gli allenamenti completati in questo mese compariranno qui." />
        ) : (
          inMonth.map((s) => (
            <button key={s.id} type="button" onClick={() => setSelected(s)} className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0">
              <div className="flex min-h-14 items-center justify-between gap-3 border-t-[0.5px] border-sep py-2.5 pr-4">
                <span>
                  <span className="block font-semibold">{s.dayName}</span>
                  <span className="block text-[13px] text-label-2">
                    {new Date(s.startedAt).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[13px] text-label-2">
                  {duration(s)}
                  <br />
                  {workSets(s)} set
                </span>
              </div>
            </button>
          ))
        )}
      </Group>

      {selected && <SessionDetail session={selected} exercises={exercises} onClose={() => setSelected(null)} />}
    </Screen>
  )
}

const duration = (s: Session) => (s.endedAt ? `${Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))} min` : '')
const workSets = (s: Session) => s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.done && x.type !== 'warmup').length, 0)

function Calendar({ month, setMonth, doneDays }: { month: Date; setMonth: (d: Date) => void; doneDays: Set<string> }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7 // lunedì = 0
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const today = dayKey(new Date())
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div className="px-2 pt-2 pb-3">
      <div className="flex items-center justify-between px-2">
        <button type="button" aria-label="Mese precedente" onClick={() => shift(-1)} className="size-11 text-[22px] text-accent">
          ‹
        </button>
        <p className="font-semibold capitalize">{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</p>
        <button type="button" aria-label="Mese successivo" onClick={() => shift(1)} className="size-11 text-[22px] text-accent">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-label-3">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />
          const key = dayKey(new Date(month.getFullYear(), month.getMonth(), d))
          const done = doneDays.has(key)
          return (
            <span key={i} className="flex h-10 items-center justify-center">
              <span
                className={`flex size-9 items-center justify-center rounded-full text-[15px] tabular-nums ${
                  done ? 'bg-done font-bold text-black' : key === today ? 'border border-accent text-accent' : ''
                }`}
              >
                {done ? '✓' : d}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function SessionDetail({ session, exercises, onClose }: { session: Session; exercises: Map<string, Exercise>; onClose: () => void }) {
  const confirm = useConfirm()
  return (
    <Sheet open title={session.dayName} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-label-2">
          {new Date(session.startedAt).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })} · {duration(session)}
          {session.sessionRpe ? ` · RPE sessione ${session.sessionRpe}` : ''}
          {session.deload ? ' · scarico' : ''}
        </p>
        {session.exercises.map((ex) => {
          const exercise = exercises.get(ex.exerciseId)
          return (
            <div key={ex.key} className="rounded-xl bg-card">
              <div className="px-4 pt-3 pb-1">
                <p className="font-semibold">{exercise?.name ?? 'Esercizio eliminato'}</p>
                {ex.week && (
                  <p className="text-[13px] text-label-2">
                    Ciclo {ex.cycle} · {WEEK_LABEL[ex.week]} · TM {formatKg(ex.tm ?? 0)} kg
                  </p>
                )}
                {ex.notes && <p className="text-[13px] text-label-2 italic">{ex.notes}</p>}
              </div>
              <ul className="pb-2">
                {ex.sets.map((s, i) => (
                  <li key={i} className={`flex justify-between gap-3 px-4 py-1 text-[15px] tabular-nums ${s.done ? '' : 'text-label-3 line-through'}`}>
                    <span className={s.type === 'warmup' ? 'text-label-2' : ''}>
                      {s.type === 'warmup' ? 'Risc. ' : s.type === 'fsl' ? 'FSL ' : s.type === 'plus' ? '+ ' : s.type === 'joker' ? 'Joker ' : ''}
                      {weightText(s.weight, exercise?.loadType)} × {s.done ? repsDone(s) : targetText(s)}
                    </span>
                    <span className="text-label-2">{s.rpe ? `RPE ${formatKg(s.rpe)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {session.notes && (
          <div className="rounded-xl bg-card p-4">
            <p className="text-[13px] font-semibold text-label-2 uppercase">Note</p>
            <p className="mt-1 whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}
        <Button
          kind="danger"
          onClick={() =>
            confirm.ask(
              "Il workout sparisce dallo storico. La posizione nei cicli non torna indietro: se serve, correggila dalla scheda Programma.",
              'Elimina workout',
              () => {
                void db.sessions.delete(session.id)
                onClose()
              },
            )
          }
        >
          Elimina workout
        </Button>
      </div>
      {confirm.node}
    </Sheet>
  )
}
