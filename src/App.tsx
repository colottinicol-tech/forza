import { useEffect, useState } from 'react'
import { ImportSheet } from './components/ImportSheet'
import { RestTimerBar, TIMER_BAR_HEIGHT } from './components/RestTimerBar'
import { SafariNotice } from './components/SafariNotice'
import { TABS, TabBar, type TabId } from './components/TabBar'
import { UpdateBanner } from './components/UpdateBanner'
import { useActiveSession, useSettings } from './lib/hooks'
import { Impostazioni } from './screens/Impostazioni'
import { Oggi } from './screens/Oggi'
import { Onboarding } from './screens/Onboarding'
import { Programma } from './screens/Programma'
import { Progressi } from './screens/Progressi'
import { Storico } from './screens/Storico'

interface ScreenProps {
  openImport: () => void
}

const SCREENS: Record<TabId, (p: ScreenProps) => React.JSX.Element | null> = {
  oggi: ({ openImport }) => <Oggi onImport={openImport} />,
  programma: ({ openImport }) => <Programma onImport={openImport} />,
  storico: Storico,
  progressi: Progressi,
  impostazioni: ({ openImport }) => <Impostazioni onImport={openImport} />,
}

// La tab attiva sta nell'indirizzo (#/storico), così resta uguale se l'app viene ricaricata.
function tabFromHash(): TabId {
  const id = location.hash.replace('#/', '')
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'oggi'
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  const [importing, setImporting] = useState(false)
  const settings = useSettings()
  const active = useActiveSession()

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (id: TabId) => {
    history.replaceState(null, '', `#/${id}`)
    setTab(id)
    window.scrollTo(0, 0)
  }

  // Durante un workout il banner "Aggiorna" resta nascosto: l'app non si ricarica mai a metà allenamento.
  const inWorkout = Boolean(active)

  if (settings && !settings.onboarded) {
    return (
      <main style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <UpdateBanner hidden />
        <Onboarding />
      </main>
    )
  }

  const Current = SCREENS[tab]
  const bottomBars = 50 + (inWorkout ? TIMER_BAR_HEIGHT : 0)

  return (
    <>
      <main
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: `calc(${bottomBars}px + env(safe-area-inset-bottom) + 16px)`,
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <UpdateBanner hidden={inWorkout} />
        <SafariNotice />
        <Current openImport={() => setImporting(true)} />
      </main>
      {active && settings && <RestTimerBar settings={settings} startedAt={active.startedAt} />}
      <TabBar active={tab} onSelect={select} />
      <ImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        onApplied={() => {
          setImporting(false)
          select('programma')
        }}
      />
    </>
  )
}
