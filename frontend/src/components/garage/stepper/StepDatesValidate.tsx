import { Divider, Group, List, Paper, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { humanizeNumber } from '../../../constants'
import { LocalTask } from '../../../types/garage'

type StepDatesValidateProps = {
  startDate: Date | null
  endDate: Date | null
  onStartDate: (value: Date | null) => void
  onEndDate: (value: Date | null) => void
  vehicleImat: string
  startMileage: number | null
  doneTasks: LocalTask[]
  plannedTasks: LocalTask[]
}

export function StepDatesValidate({
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  vehicleImat,
  startMileage,
  doneTasks,
  plannedTasks,
}: StepDatesValidateProps) {
  return (
    <Stack gap="md">
      <DatePickerInput
        label="Date de début"
        required
        valueFormat="DD/MM/YYYY"
        value={startDate}
        onChange={onStartDate}
        maxDate={new Date()}
      />
      <DatePickerInput
        label="Date de fin (optionnel)"
        valueFormat="DD/MM/YYYY"
        clearable
        value={endDate}
        onChange={onEndDate}
        minDate={startDate ?? undefined}
        maxDate={new Date()}
      />

      <Paper shadow="xs" radius={4} p="md" withBorder>
        <Stack gap="xs">
          <Text fw={600}>Récapitulatif</Text>
          <Divider />
          <Group justify="space-between">
            <Text c="dimmed">Véhicule</Text>
            <Text className="sentry-mask">{vehicleImat}</Text>
          </Group>
          <Group justify="space-between">
            <Text c="dimmed">Kilométrage</Text>
            <Text>{startMileage != null ? `${humanizeNumber(startMileage)} km` : '—'}</Text>
          </Group>

          <Text c="dimmed" mt="xs">
            Tâches réalisées {doneTasks.length ? `(${doneTasks.length})` : ''}
          </Text>
          {doneTasks.length === 0 ? (
            <Text size="sm">Aucune</Text>
          ) : (
            <List size="sm" withPadding>
              {doneTasks.map((task) => (
                <List.Item key={task.localId}>{task.name}</List.Item>
              ))}
            </List>
          )}

          <Text c="dimmed" mt="xs">
            Tâches à prévoir {plannedTasks.length ? `(${plannedTasks.length})` : ''}
          </Text>
          {plannedTasks.length === 0 ? (
            <Text size="sm">Aucune</Text>
          ) : (
            <List size="sm" withPadding>
              {plannedTasks.map((task) => (
                <List.Item key={task.localId}>{task.name}</List.Item>
              ))}
            </List>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
