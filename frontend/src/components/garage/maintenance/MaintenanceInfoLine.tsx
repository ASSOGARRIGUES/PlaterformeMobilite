import { ColorSwatch, Group, Text, UnstyledButton } from '@mantine/core'
import { MaintenanceSummary } from '../../../types/garage'
import { maintenanceInfo } from './maintenanceUtils'

/** Ligne « Entretien : ● 1 dépassé ● 2 à prévoir » du bloc Informations, cliquable vers l'onglet. */
export function MaintenanceInfoLine({ summary, onClick }: { summary: MaintenanceSummary; onClick: () => void }) {
  const info = maintenanceInfo(summary)
  return (
    <UnstyledButton onClick={onClick}>
      <Group gap={10}>
        <Text fw="bold">Entretien :</Text>
        {info.kind === 'noHistory' && <Text c="dimmed">aucun historique</Text>}
        {info.kind === 'upToDate' && <Text c="teal.8" fw={700}>à jour</Text>}
        {info.kind === 'notRecorded' && <Text c="dimmed">non renseigné</Text>}
        {info.kind === 'items' && info.items.map((item) => (
          <Group key={item.label} gap={5}>
            <ColorSwatch color={`var(--mantine-color-${item.color}-6)`} size={8} withShadow={false} />
            <Text fw={600}>{item.label}</Text>
          </Group>
        ))}
      </Group>
    </UnstyledButton>
  )
}
