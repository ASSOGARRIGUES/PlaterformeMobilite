import { useState } from 'react'
import { useList } from '@refinedev/core'
import { Drawer, TextInput, Stack, UnstyledButton, Group, Text, Badge, Button, Loader } from '@mantine/core'
import { IconSearch, IconPlus } from '@tabler/icons-react'
import { VehicleTypeEnum } from '../../types/schema.d'
import { vehicleTypeLabelMap, humanizeNumber } from '../../constants'
import { LocalTask } from '../../types/garage'
import { buildTaskPickerRows, FREE_TASK_LABEL, TaskCatalogItem } from './taskCardUtils'

type TaskPickerProps = {
  vehicleType: VehicleTypeEnum
  opened: boolean
  existingCatalogTaskIds?: number[]
  onClose: () => void
  onPick: (task: LocalTask) => void
}

function periodicityLabel(task: TaskCatalogItem): string | undefined {
  const segments: string[] = []
  if (task.km_periodicity) segments.push(`${humanizeNumber(task.km_periodicity)} km`)
  if (task.month_periodicity) {
    if (task.month_periodicity % 12 === 0) {
      const years = task.month_periodicity / 12
      segments.push(`${humanizeNumber(years)} an${years > 1 ? 's' : ''}`)
    } else {
      segments.push(`${humanizeNumber(task.month_periodicity)} mois`)
    }
  }
  return segments.length ? segments.join(' / ') : undefined
}

export function TaskPicker({ vehicleType, opened, existingCatalogTaskIds, onClose, onPick }: TaskPickerProps) {
  const [query, setQuery] = useState('')
  const [freeTaskName, setFreeTaskName] = useState<string | null>(null)

  const { data, isLoading, isError } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: [{ field: 'vehicle_types', operator: 'eq', value: vehicleType }],
    pagination: { mode: 'off' },
  })

  const catalog = (data?.data ?? []).filter((task) => !existingCatalogTaskIds?.includes(task.id))
  const rows = buildTaskPickerRows(catalog, query)

  const reset = () => {
    setQuery('')
    setFreeTaskName(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const pickCatalogTask = (task: TaskCatalogItem) => {
    onPick({
      localId: crypto.randomUUID(),
      catalogTaskId: task.id,
      name: task.name,
      // "Fait" par défaut : le flow d'ajout par défaut de cette story est le stepper d'intervention (tâches réalisées) ; l'appelant peut ré-affecter type: "planned" (ex: Epic 3)
      type: 'done',
      periodicityLabel: periodicityLabel(task),
      isWearTask: !!task.is_wear_task,
      // 10/10 = neuf, valeur de départ jusqu'à saisie réelle (0 signifierait "hors d'usage")
      wearLevel: task.is_wear_task ? 10 : undefined,
      parts: [],
      photos: [],
    })
    reset()
    onClose()
  }

  const confirmFreeTask = () => {
    if (!freeTaskName?.trim()) return
    onPick({
      localId: crypto.randomUUID(),
      name: freeTaskName.trim(),
      type: 'done',
      isWearTask: false,
      parts: [],
      photos: [],
    })
    reset()
    onClose()
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title={`Ajouter une tâche — ${vehicleTypeLabelMap[vehicleType]}`}
      styles={{ content: { borderTopLeftRadius: 20, borderTopRightRadius: 20 } }}
    >
      {freeTaskName !== null ? (
        <Stack gap="md">
          <TextInput
            label="Nom de la tâche"
            placeholder="Décrire la tâche"
            value={freeTaskName}
            onChange={(e) => setFreeTaskName(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setFreeTaskName(null)}>
              Retour
            </Button>
            <Button onClick={confirmFreeTask} disabled={!freeTaskName.trim()}>
              Ajouter
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <TextInput
            placeholder="Rechercher une tâche"
            leftSection={<IconSearch size={16} stroke={2} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          {isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : isError ? (
            <Text c="red" size="sm">
              Impossible de charger le catalogue de tâches
            </Text>
          ) : (
            <Stack gap={0}>
              {rows.map((row) =>
                row.kind === 'catalog' ? (
                  <UnstyledButton
                    key={row.task.id}
                    onClick={() => pickCatalogTask(row.task)}
                    style={{ minHeight: 48, padding: '8px 4px' }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Text>{row.task.name}</Text>
                      {periodicityLabel(row.task) && (
                        <Badge variant="light" color="cyan">
                          {periodicityLabel(row.task)}
                        </Badge>
                      )}
                    </Group>
                  </UnstyledButton>
                ) : (
                  <UnstyledButton
                    key="free-task"
                    onClick={() => setFreeTaskName('')}
                    style={{ minHeight: 48, padding: '8px 4px' }}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <IconPlus size={16} stroke={2} />
                      <Text c="dimmed">{FREE_TASK_LABEL}</Text>
                    </Group>
                  </UnstyledButton>
                )
              )}
            </Stack>
          )}
        </Stack>
      )}
    </Drawer>
  )
}
