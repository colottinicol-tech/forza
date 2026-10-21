import { EmptyState, Group, Screen } from '../components/ui'

export function Progressi() {
  return (
    <Screen title="Progressi">
      <Group>
        <EmptyState title="Ancora nessun dato" text="Grafici e record arriveranno dopo i primi allenamenti." />
      </Group>
    </Screen>
  )
}
