import { Group, Text } from '@mantine/core'
import { IconCloudCheck, IconCloudOff } from '@tabler/icons-react'

export type SaveState = 'saved' | 'offline' | 'error'

/** « Enregistré » / « Non enregistré » : évite de faire croire qu'une saisie est sauvegardée quand elle ne l'est pas. */
export function SaveStatus({ state }: { state: SaveState }) {
  const saved = state === 'saved'
  const Icon = saved ? IconCloudCheck : IconCloudOff
  const color = saved ? 'teal.7' : state === 'offline' ? 'orange.7' : 'red.7'
  return (
    <Group gap={4} wrap="nowrap" role="status" style={{ flexShrink: 0 }}>
      <Icon size={15} color={`var(--mantine-color-${color.replace('.', '-')})`} aria-hidden />
      <Text fz={11.5} fw={600} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {saved ? 'Enregistré' : 'Non enregistré'}
      </Text>
    </Group>
  )
}
