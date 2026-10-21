import { useEffect, useState } from 'react'
import { Group, Row, Screen } from '../components/ui'
import { isStandalone, isStoragePersisted } from '../lib/platform'

const buildDate = new Date(__BUILD_TIME__).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

function Status({ ok, yes, no }: { ok: boolean | null; yes: string; no: string }) {
  if (ok === null) return <span>…</span>
  return <span className={ok ? 'text-done' : 'text-label-2'}>{ok ? yes : no}</span>
}

export function Impostazioni() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const offlineReady = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

  useEffect(() => {
    void isStoragePersisted().then((p) => setPersisted(p ?? false))
  }, [])

  return (
    <Screen title="Impostazioni">
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
    </Screen>
  )
}
