import { useState } from 'react'
import { Button, Group, Loader, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { components } from '../../../types/schema'
import { LocalTask } from '../../../types/garage'
import { TaskCard } from '../TaskCard'
import { TaskPicker } from '../TaskPicker'

type Vehicle = components['schemas']['Vehicle']

type StepTasksPlannedProps = {
  vehicle: Vehicle
  tasks: LocalTask[]
  onAddTask: (task: LocalTask) => Promise<void>
  onUpdateTask: (task: LocalTask) => void
  onCommitTask?: (task: LocalTask) => void
  onRemoveTask: (localId: string) => void
  isMutating: boolean
}

export function StepTasksPlanned({
  vehicle,
  tasks,
  onAddTask,
  onUpdateTask,
  onCommitTask,
  onRemoveTask,
  isMutating,
}: StepTasksPlannedProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const existingCatalogTaskIds = tasks
    .map((task) => task.catalogTaskId)
    .filter((id): id is number => id !== undefined)

  return (
    <Stack gap="md">
      {tasks.length === 0 && (
        <Text c="dimmed" size="sm">
          Aucune tâche à prévoir pour le moment.
        </Text>
      )}
      {tasks.map((task) => (
        <TaskCard
          key={task.localId}
          task={task}
          onChange={(updated) => onUpdateTask(updated)}
          onCommit={onCommitTask}
          onRemove={() => onRemoveTask(task.localId)}
        />
      ))}
      {isMutating && (
        <Group justify="center" py="xs">
          <Loader size="sm" />
        </Group>
      )}
      <Button
        variant="light"
        leftSection={<IconPlus size={18} stroke={2} />}
        onClick={() => setPickerOpen(true)}
        disabled={isMutating}
        style={{ minHeight: 48 }}
      >
        Ajouter une tâche
      </Button>

      <TaskPicker
        vehicleType={vehicle.type!}
        opened={pickerOpen}
        existingCatalogTaskIds={existingCatalogTaskIds}
        onClose={() => setPickerOpen(false)}
        onPick={(task) => {
          if (isMutating) return
          void onAddTask({ ...task, type: 'planned' })
        }}
      />
    </Stack>
  )
}
