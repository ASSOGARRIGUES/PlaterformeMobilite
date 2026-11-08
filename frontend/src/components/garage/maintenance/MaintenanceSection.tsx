import { ReactNode } from 'react'
import { ColorSwatch, Group, Stack, Text } from '@mantine/core'
import { MAINTENANCE_SECTION_COLORS, MAINTENANCE_SECTION_HEADER_HEIGHT, MaintenanceSectionKind } from './maintenanceUtils'

const TITLES: Record<MaintenanceSectionKind, string> = {
  overdue: 'Dépassé',
  toPlan: 'À prévoir',
  upToDate: 'À jour',
  notRecorded: 'Non renseigné',
}

/** Groupe de l'onglet : l'en-tête (pastille + libellé coloré) porte le statut, pas de badge par ligne. */
export function MaintenanceSection({ kind, count, children }: { kind: MaintenanceSectionKind; count: number; children: ReactNode }) {
  const color = MAINTENANCE_SECTION_COLORS[kind]
  return (
    <Stack gap={8}>
      <Group gap={8} h={MAINTENANCE_SECTION_HEADER_HEIGHT}>
        <ColorSwatch color={`var(--mantine-color-${color}-6)`} size={10} withShadow={false} />
        <Text size="xs" fw={800} tt="uppercase" c={`${color}.8`} style={{ letterSpacing: '0.06em' }}>
          {TITLES[kind]}
        </Text>
        <Text size="xs" fw={600} c="dimmed">{count}</Text>
      </Group>
      {children}
    </Stack>
  )
}
