import { Box, Group, Stack, Text, Title } from '@mantine/core'
import { IconClipboardOff } from '@tabler/icons-react'
import { MeasurableTask } from '../../../types/garage'
import { PagerDots } from '../PagerDots'
import { WearInput, WearTaskCard } from '../WearTaskCard'
import { WearConfig } from '../wearUtils'
import { chunkWearTasks } from '../../../hooks/garage/inspectionStepperUtils'

type WearStepBodyProps = {
  tasks: MeasurableTask[]
  values: Record<number, number>
  onSet: (taskId: number, value: number | null) => void
  page: number
  perPage: number
  input: WearInput
  config: WearConfig
  /** Dernière mesure connue par tâche (affichée seulement quand il n'y a qu'une tâche). */
  last?: Record<number, { level: number; date: string | null }>
}

/** Étape Usure : titre + points de page sur une ligne, puis `perPage` cartes ; aucune page si aucune tâche mesurable. */
export function WearStepBody({ tasks, values, onSet, page, perPage, input, config, last }: WearStepBodyProps) {
  const pages = chunkWearTasks(tasks, perPage)
  const current = pages[Math.min(page, Math.max(0, pages.length - 1))] ?? []
  const single = tasks.length === 1

  return (
    <Stack gap={12} h="100%">
      <Group justify="space-between" mih={30} wrap="nowrap">
        <Title order={3}>Usure</Title>
        <PagerDots count={pages.length} index={page} />
      </Group>
      {tasks.length === 0 ? (
        <Stack align="center" justify="center" gap={12} ta="center" px="md" style={{ flex: 1 }}>
          <Box w={72} h={72} bg="gray.1" c="dimmed" style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconClipboardOff size={36} aria-hidden />
          </Box>
          <Text fw={700} fz={17}>Aucune mesure d&apos;usure pour ce type de véhicule.</Text>
          <Text c="dimmed">Passez à l&apos;étape suivante.</Text>
        </Stack>
      ) : (
        <Stack gap={12}>
          {current.map((task) => (
            <WearTaskCard
              key={task.id}
              task={task}
              value={values[task.id]}
              onChange={(value) => onSet(task.id, value)}
              input={input}
              config={config}
              roomy={single}
              last={single ? last?.[task.id] : null}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
