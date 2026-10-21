import { EmptyState, Group, Screen } from '../components/ui'

export function Storico() {
  return (
    <Screen title="Storico">
      <Group>
        <EmptyState title="Nessun allenamento" text="Gli allenamenti completati compariranno qui." />
      </Group>
    </Screen>
  )
}
