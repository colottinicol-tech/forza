import { useEffect, useState } from 'react'
import { SafariNotice } from './components/SafariNotice'
import { TABS, TabBar, type TabId } from './components/TabBar'
import { UpdateBanner } from './components/UpdateBanner'
import { Impostazioni } from './screens/Impostazioni'
import { Oggi } from './screens/Oggi'
import { Programma } from './screens/Programma'
import { Progressi } from './screens/Progressi'
import { Storico } from './screens/Storico'

const SCREENS: Record<TabId, (p: { go: (id: TabId) => void }) => React.JSX.Element | null> = {
  oggi: ({ go }) => <Oggi onImport={() => go('impostazioni')} />,
  programma: Programma,
  storico: Storico,
  progressi: Progressi,
  impostazioni: Impostazioni,
}

// La tab attiva sta nell'indirizzo (#/storico), così resta uguale se l'app viene ricaricata.
function tabFromHash(): TabId {
  const id = location.hash.replace('#/', '')
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'oggi'
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)

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

  const Current = SCREENS[tab]

  return (
    <>
      <main
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(50px + env(safe-area-inset-bottom) + 16px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <UpdateBanner />
        <SafariNotice />
        <Current go={select} />
      </main>
      <TabBar active={tab} onSelect={select} />
    </>
  )
}
