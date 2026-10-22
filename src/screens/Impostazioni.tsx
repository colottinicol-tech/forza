// Impostazioni: pesi e dischi, progressione, timer, backup e import, stato dell'app.
import { useEffect, useState } from 'react'
import { Button, Choice, Field, Sheet, Stepper } from '../components/controls'
import { Group, Row, Screen } from '../components/ui'
import { exportBackup, readBackup, restoreBackup, type BackupSummary } from '../lib/dataio'
import { updateSettings } from '../lib/db'
import { formatKg } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { isStandalone, isStoragePersisted } from '../lib/platform'
import type { Settings } from '../lib/types'
import { ROUNDING_MODES, ROUNDING_STEPS } from './Onboarding'

const buildDate = new Date(__BUILD_TIME__).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

function Status({ ok, yes, no }: { ok: boolean | null; yes: string; no: string }) {
  if (ok === null) return <span>…</span>
  return <span className={ok ? 'text-done' : 'text-label-2'}>{ok ? yes : no}</span>
}

type Panel = 'weights' | 'warmup' | 'progression' | null

export function Impostazioni({ onImport }: { onImport: () => void }) {
  const settings = useSettings()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<BackupSummary | string | null>(null)
  const offlineReady = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

  useEffect(() => {
    void isStoragePersisted().then((p) => setPersisted(p ?? false))
  }, [])
  if (!settings) return null

  const doExport = async () => {
    setBackupMsg(null)
    const r = await exportBackup()
    if (r === 'shared') setBackupMsg('Backup salvato. Controlla di averlo messo in File (iCloud Drive).')
    if (r === 'downloaded') setBackupMsg('Backup scaricato.')
  }

  const pickBackup = async (file: File | undefined) => {
    if (!file) return
    setRestoring(readBackup(await file.text()))
  }


  return (
    <Screen title="Impostazioni">
      <Group header="Dati" footer={backupMsg ?? 'Il backup è un file con tutti i tuoi dati. Salvalo in File (iCloud Drive) ogni tanto.'}>
        <ActionRow label="Esporta backup" onClick={() => void doExport()} />
        <label className="block cursor-pointer pl-4 active:bg-card-2">
          <div className="flex min-h-11 items-center border-t-[0.5px] border-sep py-2.5 pr-4 text-accent">Importa backup</div>
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => void pickBackup(e.target.files?.[0])} />
        </label>
        <ActionRow label="Importa da Claude" onClick={onImport} />
        <Row
          title="Ultimo backup"
          detail={settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString('it-IT') : 'mai'}
        />
      </Group>

      <Group header="Allenamento">
        <NavRow label="Arrotondamento dei pesi" detail={`${formatKg(settings.roundingStep)} kg`} onClick={() => setPanel('weights')} />
        <NavRow label="Riscaldamento dei principali" detail={settings.warmup.map((w) => `${Math.round(w.pct * 100)}%`).join(' / ')} onClick={() => setPanel('warmup')} />
        <NavRow label="Progressione e e1RM" detail={`+${formatKg(settings.upperIncrement)} / +${formatKg(settings.lowerIncrement)}`} onClick={() => setPanel('progression')} />
      </Group>

      <Group header="Stato dell'app" footer="Servono per controllare che l'installazione sull'iPhone sia corretta.">
        <Row title="Aperta da" detail={isStandalone() ? 'Schermata Home' : 'Safari'} />
        <Row title="Funziona offline">
          <Status ok={offlineReady} yes="Sì" no="Non ancora" />
        </Row>
        <Row title="Dati protetti">
          <Status ok={persisted} yes="Sì" no="No" />
        </Row>
        <Row title="Versione" detail={`${__APP_VERSION__} · ${buildDate}`} />
      </Group>

      <SettingsPanel panel={panel} settings={settings} onClose={() => setPanel(null)} />

      <Sheet open={restoring !== null} title="Importa backup" onClose={() => setRestoring(null)} doneLabel="Annulla">
        {typeof restoring === 'string' ? (
          <p className="text-[15px] text-danger">{restoring}</p>
        ) : (
          restoring && (
            <div className="flex flex-col gap-4">
              <p className="text-[15px]">
                Backup del {restoring.exportedAt ? new Date(restoring.exportedAt).toLocaleString('it-IT') : '?'}:{' '}
                {restoring.counts.sessions} allenamenti, {restoring.counts.exercises} esercizi, {restoring.counts.days} giorni.
              </p>
              <p className="text-[15px] text-danger">
                Tutti i dati attuali su questo telefono verranno sostituiti da quelli del backup.
              </p>
              <Button
                kind="danger"
                onClick={() =>
                  void restoreBackup(restoring).then(() => {
                    setRestoring(null)
                    setBackupMsg('Backup ripristinato.')
                  })
                }
              >
                Sostituisci tutti i dati
              </Button>
            </div>
          )
        )}
      </Sheet>
    </Screen>
  )
}

function ActionRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0">
      <div className="flex min-h-11 items-center border-t-[0.5px] border-sep py-2.5 pr-4 text-accent">{label}</div>
    </button>
  )
}

function NavRow({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full pl-4 text-left active:bg-card-2 [&:first-child>div]:border-t-0">
      <div className="flex min-h-11 items-center justify-between gap-3 border-t-[0.5px] border-sep py-2.5 pr-4">
        <span>{label}</span>
        <span className="shrink-0 text-label-2">
          {detail} <span className="text-label-3">›</span>
        </span>
      </div>
    </button>
  )
}

function SettingsPanel({ panel, settings, onClose }: { panel: Panel; settings: Settings; onClose: () => void }) {
  const set = (p: Partial<Settings>) => void updateSettings(p)
  const titles: Record<Exclude<Panel, null>, string> = {
    weights: 'Arrotondamento dei pesi',
    warmup: 'Riscaldamento',
    progression: 'Progressione e e1RM',
  }
  return (
    <Sheet open={panel !== null} title={panel ? titles[panel] : ''} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {panel === 'weights' && (
          <>
            <Field label="Arrotonda a">
              <Choice options={ROUNDING_STEPS} value={settings.roundingStep} onChange={(v) => v && set({ roundingStep: v })} />
            </Field>
            <Field label="Come arrotondare">
              <Choice options={ROUNDING_MODES} value={settings.roundingMode} onChange={(v) => v && set({ roundingMode: v })} />
            </Field>
          </>
        )}
        {panel === 'warmup' && (
          <>
            <p className="text-[15px] text-label-2">
              Set di riscaldamento generati per gli esercizi principali, in % del TM. Si spuntano ma non contano nel volume.
            </p>
            {settings.warmup.map((w, i) => (
              <div key={i} className="rounded-xl bg-card p-3">
                <Stepper
                  label="% TM"
                  value={Math.round(w.pct * 100)}
                  onChange={(v) => set({ warmup: settings.warmup.map((x, j) => (j === i ? { ...x, pct: Math.min(100, Math.max(10, v ?? 40)) / 100 } : x)) })}
                  step={5}
                  min={10}
                  max={100}
                  suffix="%"
                />
                <div className="mt-2">
                  <Stepper label="Reps" value={w.reps} onChange={(v) => set({ warmup: settings.warmup.map((x, j) => (j === i ? { ...x, reps: Math.max(1, v ?? 5) } : x)) })} min={1} max={20} />
                </div>
                <button type="button" className="mt-1 min-h-11 text-[15px] text-danger" onClick={() => set({ warmup: settings.warmup.filter((_, j) => j !== i) })}>
                  Togli questo set
                </button>
              </div>
            ))}
            <Button
              kind="secondary"
              onClick={() => {
                const last = settings.warmup[settings.warmup.length - 1]
                set({ warmup: [...settings.warmup, { pct: Math.min(0.9, (last?.pct ?? 0.3) + 0.1), reps: 3 }] })
              }}
            >
              + Aggiungi set di riscaldamento
            </Button>
          </>
        )}
        {panel === 'progression' && (
          <>
            <Field label="Aumento del TM a fine ciclo (regola standard)">
              <div className="flex flex-col gap-2">
                <Stepper label="Upper" value={settings.upperIncrement} onChange={(v) => set({ upperIncrement: v ?? 0 })} step={1.25} decimal suffix="kg" />
                <Stepper label="Lower" value={settings.lowerIncrement} onChange={(v) => set({ lowerIncrement: v ?? 0 })} step={1.25} decimal suffix="kg" />
              </div>
            </Field>
            <Field label="Set «+» per l'e1RM">
              <Choice
                options={[
                  { value: 0, label: 'Reps fatte' },
                  { value: 1, label: 'Reps fatte + 1' },
                  { value: 2, label: 'Reps fatte + 2' },
                ]}
                value={settings.plusRepsBonus}
                onChange={(v) => v !== null && set({ plusRepsBonus: v })}
              />
              <p className="mt-2 text-[13px] text-label-2">
                «+ 1» se chiudi i set «+» a RPE 9 (una rep in riserva) invece che al cedimento.
              </p>
            </Field>
          </>
        )}
      </div>
    </Sheet>
  )
}
