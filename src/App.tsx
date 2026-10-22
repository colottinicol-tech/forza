import { useEffect, useState } from 'react'
import { ImportSheet } from './components/ImportSheet'
import { SafariNotice } from './components/SafariNotice'
import { TAB_BAR_SPACE, TABS, TabBar, type TabId } from './components/TabBar'
import { UpdateBanner } from './components/UpdateBanner'
import { useSettings } from './lib/hooks'
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

  if (settings && !settings.onboarded) {
    return (
      <main style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <UpdateBanner />
        <Onboarding />
      </main>
    )
  }

  const Current = SCREENS[tab]

  return (
    <>
      <main
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: TAB_BAR_SPACE,
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <UpdateBanner />
        <SafariNotice />
        <Current openImport={() => setImporting(true)} />
      </main>
      <TabBar active={tab} onSelect={select} />
      <ImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        onApplied={() => {
          setImporting(false)
          select('oggi')
        }}
      />
    </>
  )
}
