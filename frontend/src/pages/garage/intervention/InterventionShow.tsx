import { useMemo } from 'react'
import { useGetToPath, useGo, useList, useResource } from '@refinedev/core'
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertTriangle, IconEdit } from '@tabler/icons-react'
import { humanizeDate, humanizeFirstName, humanizeNumber } from '../../../constants'
import { useInterventionSheetShow } from '../../../hooks/garage/useInterventionSheetShow'
import { TaskCatalogItem } from '../../../components/garage/taskCardUtils'
import { localTaskFromApiTask } from '../../../hooks/garage/interventionStepperUtils'
import { TaskCard } from '../../../components/garage/TaskCard'
import { InterventionStatusBadge } from '../../../components/garage/intervention/InterventionStatusBadge'
import CanAccess from '../../../components/CanAccess'
import { InterventionSheet } from '../../../types/garage'

const noop = () => undefined

type InterventionShowProps = {
  sheetId: number
}

export function InterventionShow({ sheetId }: InterventionShowProps) {
  const go = useGo()
  const getToPath = useGetToPath()
  const { select } = useResource()
  const theme = useMantineTheme()
  const smallerThanMd = useMediaQuery(`(max-width: ${theme.breakpoints.md})`)

  const { sheet, vehicle, isLoading } = useInterventionSheetShow(sheetId)

  const { data: catalogData } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: vehicle ? [{ field: 'vehicle_types', operator: 'eq', value: vehicle.type }] : [],
    pagination: { mode: 'off' },
    queryOptions: { enabled: !!vehicle },
  })
  const catalogById = useMemo(() => {
    const map = new Map<number, TaskCatalogItem>()
    ;(catalogData?.data ?? []).forEach((item) => map.set(item.id, item))
    return map
  }, [catalogData])

  const { doneTasks, plannedTasks } = useMemo(() => {
    if (!sheet) return { doneTasks: [], plannedTasks: [] }
    const rebuilt = sheet.tasks.map((task) => localTaskFromApiTask(task, catalogById))
    return {
      doneTasks: rebuilt.filter((task) => task.type === 'done'),
      plannedTasks: rebuilt.filter((task) => task.type === 'planned'),
    }
  }, [sheet, catalogById])

  const { data: siblingData } = useList<InterventionSheet>({
    resource: 'garage/intervention',
    filters: vehicle ? [{ field: 'vehicle', operator: 'eq', value: vehicle.id }] : [],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!vehicle },
  })
  const moreRecentSheet = (siblingData?.data ?? [])
    .filter((s) => s.id !== sheetId && sheet != null && s.created_at > sheet.created_at)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0]

  const vehiclePath = getToPath({ resource: select('vehicle').resource, action: 'show', meta: { id: vehicle?.id } })

  if (isLoading || !sheet || !vehicle) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    )
  }

  const stats: { k: string; v: string; mono?: boolean }[] = [
    { k: 'Kilométrage', v: sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—', mono: true },
    { k: 'Début', v: sheet.start_date ? humanizeDate(sheet.start_date) : '—' },
    { k: 'Fin', v: sheet.end_date ? humanizeDate(sheet.end_date) : '—' },
    { k: 'Tâches', v: `${doneTasks.length} faites · ${plannedTasks.length} à prévoir` },
  ]
  const statCols = smallerThanMd ? 2 : 4

  return (
    <Stack style={{ height: '100%' }} gap="md">
      <Paper shadow="sm" p="lg" radius="md">
        <Text size="xs" c="dimmed" mb="sm">
          <Anchor size="xs" c="dimmed" onClick={() => go({ to: '/garage' })}>Garage</Anchor>
          {' / '}
          <Anchor size="xs" c="dimmed" onClick={() => go({ to: '/garage/intervention' })}>Interventions</Anchor>
          {' / '}#{sheet.id}
        </Text>

        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group gap="md" align="center">
            <InterventionStatusBadge status={sheet.status} />
            <div>
              <Title order={2} className="sentry-mask">{vehicle.imat}</Title>
              <Text size="sm" c="dimmed">
                {vehicle.brand} {vehicle.modele}
                {sheet.created_by && ` · ouverte par ${humanizeFirstName(sheet.created_by.first_name)} ${sheet.created_by.last_name}`}
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            {moreRecentSheet && (
              <Tooltip
                multiline
                w={280}
                label={`Une intervention plus récente existe sur ce véhicule (${humanizeDate(moreRecentSheet.created_at)}). Toute tâche ajoutée ou modifiée ici ne sera prise en compte que jusqu'à cette date.`}
              >
                <ActionIcon variant="subtle" color="orange" radius="xl" aria-label="Fiche plus récente disponible">
                  <IconAlertTriangle size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            <Button variant="default" onClick={() => go({ to: vehiclePath })}>
              Voir le véhicule
            </Button>
            <CanAccess permKey="garage.manage_intervention">
              <Button
                leftSection={<IconEdit size={16} />}
                onClick={() => go({ to: `/garage/intervention/${sheetId}/edit` })}
              >
                Modifier
              </Button>
            </CanAccess>
          </Group>
        </Group>
      </Paper>

      <Paper shadow="sm" radius="md" style={{ overflow: 'hidden' }}>
        <SimpleGrid cols={statCols} spacing={0}>
          {stats.map((stat, index) => {
            const isLastInRow = (index + 1) % statCols === 0
            const isLastRow = index >= stats.length - statCols
            return (
              <Box
                key={stat.k}
                px="lg"
                py="md"
                style={{
                  borderRight: isLastInRow ? undefined : '1px solid var(--mantine-color-gray-2)',
                  borderBottom: isLastRow ? undefined : '1px solid var(--mantine-color-gray-2)',
                }}
              >
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>{stat.k}</Text>
                <Text fw={700} ff={stat.mono ? 'monospace' : undefined} style={stat.mono ? { fontVariantNumeric: 'tabular-nums' } : undefined}>
                  {stat.v}
                </Text>
              </Box>
            )
          })}
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={smallerThanMd ? 1 : 2} spacing="md">
        <Paper shadow="sm" p="lg" radius="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Tâches réalisées</Text>
            <Badge variant="light" color="teal">{doneTasks.length}</Badge>
          </Group>
          <Stack gap="sm">
            {doneTasks.length === 0 && <Text c="dimmed" size="sm">Aucune tâche réalisée</Text>}
            {doneTasks.map((task) => (
              <TaskCard key={task.localId} task={task} readOnly onChange={noop} onRemove={noop} />
            ))}
          </Stack>
        </Paper>

        <Paper shadow="sm" p="lg" radius="md">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Tâches à prévoir</Text>
            <Badge variant="light" color="orange">{plannedTasks.length}</Badge>
          </Group>
          <Stack gap="sm">
            {plannedTasks.length === 0 && <Text c="dimmed" size="sm">Aucune tâche à prévoir</Text>}
            {plannedTasks.map((task) => (
              <TaskCard key={task.localId} task={task} readOnly onChange={noop} onRemove={noop} />
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
