import { useMemo } from 'react'
import { useGo, useList } from '@refinedev/core'
import { ActionIcon, Box, Center, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { VehicleTypeEnum } from '../../types/schema.d'
import { InterventionSheet } from '../../types/garage'
import { TaskCatalogItem } from './taskCardUtils'
import { unresolvedPlannedTasks } from '../../hooks/garage/interventionStepperUtils'
import { TaskCard } from './TaskCard'

type PlannedTasksPanelProps = {
  vehicleId: number
  vehicleType: VehicleTypeEnum
}

// Lecture seule : aucune mutation possible, TaskCard exige néanmoins les callbacks
const noop = () => undefined

/** Liste consolidée "à prévoir" (FR-4.7) des fiches validées — lecture seule (AC5). */
export function PlannedTasksPanel({ vehicleId, vehicleType }: PlannedTasksPanelProps) {
  const go = useGo()
  const { data: catalogData } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: [{ field: 'vehicle_types', operator: 'eq', value: vehicleType }],
    pagination: { mode: 'off' },
  })
  const catalogById = useMemo(() => {
    const map = new Map<number, TaskCatalogItem>()
    ;(catalogData?.data ?? []).forEach((item) => map.set(item.id, item))
    return map
  }, [catalogData])

  const { data, isLoading } = useList<InterventionSheet>({
    resource: 'garage/intervention',
    filters: [
      { field: 'vehicle', operator: 'eq', value: vehicleId },
      { field: 'status', operator: 'eq', value: 'validated' },
    ],
    pagination: { pageSize: 100 },
  })

  const tasks = useMemo(() => {
    if (!data) return []
    return unresolvedPlannedTasks(data.data, catalogById)
  }, [data, catalogById])

  if (isLoading) {
    return (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    )
  }

  if (tasks.length === 0) {
    return <Text c="dimmed">Aucune tâche à prévoir</Text>
  }

  return (
    <Stack>
      {tasks.map((task) => (
        <Box key={task.localId} pos="relative">
          <TaskCard task={task} readOnly onChange={noop} onRemove={noop} />
          {task.sheetId != null && (
            <Tooltip label="Voir la fiche source">
              <ActionIcon
                pos="absolute"
                top={8}
                right={8}
                variant="subtle"
                onClick={() => go({ to: `/garage/intervention/${task.sheetId}` })}
                aria-label="Voir la fiche source"
              >
                <IconExternalLink size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      ))}
    </Stack>
  )
}
