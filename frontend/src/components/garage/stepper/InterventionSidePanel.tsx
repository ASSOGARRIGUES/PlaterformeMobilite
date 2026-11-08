import { ReactNode } from 'react'
import { Badge, ColorSwatch, Group, Paper, ScrollArea, Stack, Text, Tooltip } from '@mantine/core'
import { IconClock, IconInfoCircle, IconTool } from '@tabler/icons-react'
import { components } from '../../../types/schema'
import { InterventionSheet, LocalTask, MaintenanceTask } from '../../../types/garage'
import { humanizeDate, humanizeNumber } from '../../../constants'
import { TaskCatalogItem } from '../taskCardUtils'
import { PendingSuggestions, dedupedHistorySummaries, sidePanelCardVisibility } from '../../../hooks/garage/interventionStepperUtils'
import { CriticalMark, WearBadge } from '../maintenance/TaskRowParts'
import { MAINTENANCE_SECTION_COLORS, mainFigure, toPlanReason } from '../maintenance/maintenanceUtils'
import VehicleAvatar from '../../Vehicle/VehicleAvatar'

type Vehicle = components['schemas']['Vehicle']

type InterventionSidePanelProps = {
  vehicle: Vehicle
  plannedTasks: LocalTask[]
  /** Suggestions de la synthèse d'entretien (création uniquement) — non fourni en édition d'une fiche validée (story 2.7) */
  suggestions?: PendingSuggestions
  history: InterventionSheet[]
  catalogById: Map<number, TaskCatalogItem>
  /** Étape active desktop (0-4, cf. sidePanelCardVisibility) */
  activeStep: number
}

/** Ligne de la carte « À prévoir sur ce véhicule » : point de statut, nom, raison, écart principal. */
function UpcomingRow({ task, kind }: { task: MaintenanceTask; kind: 'overdue' | 'toPlan' }) {
  const color = MAINTENANCE_SECTION_COLORS[kind]
  const reason = toPlanReason(task)
  const figure = mainFigure(task)
  return (
    <Group gap={8} wrap="nowrap" align="center">
      <ColorSwatch color={`var(--mantine-color-${color}-6)`} size={10} withShadow={false} style={{ flexShrink: 0 }} />
      <Group gap={6} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={600}>{task.name}</Text>
        {task.is_critical && <CriticalMark />}
        {reason === 'usure' && task.last_realization?.wear_level != null && (
          <WearBadge wearLevel={task.last_realization.wear_level} wearIsReason inline={false} />
        )}
        {reason === 'signalement' && <Badge size="sm" variant="outline" color="orange" tt="none">Signalé</Badge>}
      </Group>
      {figure && <Text size="xs" fw={700} c={`${color}.8`} style={{ whiteSpace: 'nowrap' }}>{figure}</Text>}
    </Group>
  )
}

function CardLabel({ children, mb = 'xs' }: { children: ReactNode; mb?: string | number }) {
  return (
    <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={mb}>
      {children}
    </Text>
  )
}

export function InterventionSidePanel({
  vehicle,
  plannedTasks,
  suggestions,
  history,
  catalogById,
  activeStep,
}: InterventionSidePanelProps) {
  const visibility = sidePanelCardVisibility(activeStep)
  const hasUpcoming = suggestions
    ? suggestions.overdue.length + suggestions.toPlan.length + suggestions.signalements.length > 0
    : plannedTasks.length > 0
  const historySummaries = dedupedHistorySummaries(history, catalogById)
  const hasScrollableContent = (visibility.upcoming && hasUpcoming) || visibility.history

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 'var(--mantine-spacing-md)' }}>
      {visibility.vehicle && (
        <Paper shadow="xs" radius={4} p="md" withBorder style={{ flexShrink: 0 }}>
          <CardLabel>Véhicule</CardLabel>
          <Group gap="sm" mb="sm" wrap="nowrap">
            <VehicleAvatar vehicle={vehicle} size={40} />
            <div className="sentry-mask" style={{ minWidth: 0 }}>
              <Text fw={700} size="sm">
                {vehicle.brand} {vehicle.modele}
              </Text>
              <Text size="xs" c="dimmed">
                {vehicle.imat}
              </Text>
            </div>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Dernier relevé
            </Text>
            <Text size="sm" ff="monospace" fw={600}>
              {humanizeNumber(vehicle.kilometer)} km
            </Text>
          </Group>
        </Paper>
      )}

      {hasScrollableContent && (
        // ScrollArea Mantine (déjà utilisé dans InterventionStepperShell) : scrollbar en overlay,
        // ne prend pas de place dans la largeur du contenu — pas de bricolage marge/padding.
        <ScrollArea style={{ flex: 1, minHeight: 0 }} scrollbarSize={6} type="hover">
          <Stack gap="md">
            {visibility.upcoming && hasUpcoming && (
              <Paper shadow="xs" radius={4} p="md" withBorder>
                {suggestions ? (
                  <>
                    <CardLabel>À prévoir sur ce véhicule</CardLabel>
                    <Stack gap="xs">
                      {suggestions.overdue.map((task) => <UpcomingRow key={task.catalog_task_id} task={task} kind="overdue" />)}
                      {suggestions.toPlan.map((task) => <UpcomingRow key={task.catalog_task_id} task={task} kind="toPlan" />)}
                      {suggestions.signalements.map((signalement) => (
                        <Group key={signalement.task_id} gap={8} wrap="nowrap" align="center">
                          <ColorSwatch color="var(--mantine-color-orange-6)" size={10} withShadow={false} style={{ flexShrink: 0 }} />
                          <Text size="sm" fw={600}>{signalement.name}</Text>
                          <Badge size="sm" variant="outline" color="orange" tt="none">Signalé</Badge>
                        </Group>
                      ))}
                    </Stack>
                  </>
                ) : (
                  <>
                    <CardLabel>Prévues sur cette fiche</CardLabel>
                    <Stack gap="xs">
                      {plannedTasks.map((task) => (
                        <Group key={task.localId} gap={8} wrap="nowrap" align="flex-start">
                          <IconClock size={16} color="var(--mantine-color-orange-6)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <Text size="sm" fw={600}>{task.name}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </>
                )}
              </Paper>
            )}

            {visibility.history && (
              <Paper shadow="xs" radius={4} p="md" withBorder>
                <Group gap={6} mb="xs" align="center">
                  <CardLabel mb={0}>Historique</CardLabel>
                  <Tooltip
                    multiline
                    w={260}
                    label="Chaque tâche n'apparaît qu'une fois, sur sa fiche la plus récente : si elle a été refaite depuis, l'ancienne occurrence est masquée. Une fiche dont toutes les tâches ont été refaites depuis n'est plus affichée."
                  >
                    <IconInfoCircle size={14} color="var(--mantine-color-gray-6)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
                {historySummaries.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Aucun historique enregistré.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {historySummaries.map((summary) => (
                      <Group
                        key={summary.id}
                        gap={10}
                        wrap="nowrap"
                        align="flex-start"
                        style={{ paddingBottom: 8, borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                      >
                        <IconTool size={16} style={{ marginTop: 2, flexShrink: 0 }} color="var(--mantine-color-gray-6)" />
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={700}>
                            {summary.taskNames}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {humanizeDate(summary.date)}
                            {summary.mileage != null && ` · ${humanizeNumber(summary.mileage)} km`}
                            {' · '}
                            {summary.partsCost.toFixed(2)} €
                          </Text>
                        </div>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Paper>
            )}
          </Stack>
        </ScrollArea>
      )}
    </div>
  )
}
