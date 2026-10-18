import { useState } from 'react'
import { Button, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { components } from '../../../types/schema'
import { LocalTask } from '../../../types/garage'
import { TaskCard } from '../TaskCard'
import { TaskPicker } from '../TaskPicker'

type Vehicle = components['schemas']['Vehicle']

type PlannedOpsStepProps = {
  vehicle: Vehicle
  tasks: LocalTask[]
  isMutating: boolean
  onAdd: (task: LocalTask) => Promise<void>
  onChange: (task: LocalTask) => void
  onRemove: (localId: string) => void
}

/** Étape 7 : le garagiste ajoute des opérations à programmer ; aucune suggestion (l'onglet Entretien en reste la source). */
export function PlannedOpsStep({ vehicle, tasks, isMutating, onAdd, onChange, onRemove }: PlannedOpsStepProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const existingCatalogTaskIds = tasks.map((task) => task.catalogTaskId).filter((id): id is number => id !== undefined)

  return (
    <Stack gap="sm">
      <Text c="dimmed" size="sm">Opérations à programmer.</Text>
      {tasks.length > 0 && <Text fw={700} size="sm">À prévoir ({tasks.length})</Text>}
      {tasks.map((task) => (
        <TaskCard
          key={task.localId}
          variant="planned"
          task={task}
          onChange={onChange}
          onRemove={() => onRemove(task.localId)}
        />
      ))}
      <Button
        variant="light"
        mih={52}
        leftSection={<IconPlus size={18} />}
        disabled={isMutating}
        onClick={() => setPickerOpen(true)}
      >
        Ajouter une opération
      </Button>
      <TaskPicker
        vehicleType={vehicle.type!}
        opened={pickerOpen}
        existingCatalogTaskIds={existingCatalogTaskIds}
        onClose={() => setPickerOpen(false)}
        onPick={(task) => {
          if (isMutating) return
          void onAdd({ ...task, type: 'planned' })
        }}
      />
    </Stack>
  )
}
