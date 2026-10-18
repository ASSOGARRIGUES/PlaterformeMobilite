import { Divider, Group, List, Paper, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { humanizeDate, humanizeNumber } from '../../../constants'
import { LocalTask, MileageEntry } from '../../../types/garage'
import { computePartsSubtotal } from '../taskCardUtils'
import { MileageNotAppliedAlert } from './MileageNotAppliedAlert'

type StepDatesValidateProps = {
  startDate: Date | null
  endDate: Date | null
  onStartDate: (value: Date | null) => void
  onEndDate: (value: Date | null) => void
  vehicleImat: string
  startMileage: number | null
  doneTasks: LocalTask[]
  plannedTasks: LocalTask[]
  /** 'dates' : étape "Dates". 'recap' : étape "Récapitulatif". Deux vues séparées du même contenu. */
  mode: 'dates' | 'recap'
  /** Relevé postérieur à la date de début : affiche l'encart "kilométrage non mis à jour" (création uniquement). */
  moreRecentEntry?: MileageEntry | null
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
  mode,
  moreRecentEntry,
}: StepDatesValidateProps) {
  const showDates = mode === 'dates'
  const showRecap = mode === 'recap'
  const partsTotal = computePartsSubtotal(doneTasks.flatMap((task) => task.parts))

  return (
    <Stack gap="md">
      {showDates && (
        <>
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
        </>
      )}

      {moreRecentEntry && <MileageNotAppliedAlert moreRecentEntry={moreRecentEntry} />}

      {showRecap && (
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

            {mode === 'recap' && (
              <>
                <Divider />
                <Group justify="space-between">
                  <Text c="dimmed">Coût total pièces</Text>
                  <Text ff="monospace" fw={600}>
                    {partsTotal.toFixed(2)} €
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">Début</Text>
                  <Text>{startDate ? humanizeDate(startDate.toISOString()) : '—'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">Fin</Text>
                  <Text>{endDate ? humanizeDate(endDate.toISOString()) : '—'}</Text>
                </Group>
              </>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  )
}
