import { useState } from 'react'
import { EmptyState, Group, Screen } from '../components/ui'
import { formatDateLong } from '../lib/format'

export function Oggi() {
  const [today] = useState(() => new Date())
  return (
    <Screen title="Oggi" subtitle={formatDateLong(today)}>
      <Group>
        <EmptyState
          title="Nessun programma"
          text="Quando avrai caricato il tuo programma, qui troverai l'allenamento da fare."
        />
      </Group>
    </Screen>
  )
}
