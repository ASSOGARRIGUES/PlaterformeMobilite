import { Modal, Group, Stack, Text, Button, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

type MaintenanceWarningModalProps = {
  opened: boolean
  vehicleImat: string
  cause: string
  onConfirm: () => void
  onCancel: () => void
}

export function MaintenanceWarningModal({ opened, vehicleImat, cause, onConfirm, onCancel }: MaintenanceWarningModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      radius={8}
      centered
      title={
        <Group gap="sm">
          <ThemeIcon color="orange" variant="light" radius="xl" size="lg">
            <IconAlertTriangle size={20} stroke={2} />
          </ThemeIcon>
          <Text fw={600}>{vehicleImat}</Text>
        </Group>
      }
    >
      <Stack gap="lg">
        <Text>{cause}</Text>
        <Group justify="flex-end">
          <Button variant="outline" onClick={onCancel}>
            Modifier la saisie
          </Button>
          <Button color="orange" onClick={onConfirm}>
            Confirmer
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
