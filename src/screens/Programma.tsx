import { EmptyState, Group, Screen } from '../components/ui'

export function Programma() {
  return (
    <Screen title="Programma">
      <Group>
        <EmptyState
          title="Il programma è vuoto"
          text="Lo prepareremo insieme a Claude e lo caricherai con «Importa da Claude»."
        />
      </Group>
    </Screen>
  )
}
