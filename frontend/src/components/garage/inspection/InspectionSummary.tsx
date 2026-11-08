import { ReactNode } from 'react'
import { Group, Paper, Stack, Text } from '@mantine/core'
import { IconCalendarPlus, IconCheck, IconX } from '@tabler/icons-react'
import { humanizeNumber } from '../../../constants'
import { InspectionDraft } from '../../../hooks/garage/inspectionStepperUtils'
import { LocalDamage, LocalTask, MeasurableTask, MileageEntry } from '../../../types/garage'
import { MileageNotAppliedAlert } from '../stepper/MileageNotAppliedAlert'
import { taskIcon } from '../maintenance/taskIcons'
import { WearInput } from '../WearTaskCard'
import { WEAR_ZONES, WearConfig, wearZoneKey } from '../wearUtils'
import { DamageChoice } from '../../../hooks/garage/useInspectionStepper'

type InspectionSummaryProps = {
  draft: InspectionDraft
  tasks: MeasurableTask[]
  damages: LocalDamage[]
  damageChoice: DamageChoice
  plannedTasks: LocalTask[]
  config: WearConfig
  input: WearInput
  moreRecentEntry: MileageEntry | null
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text fz={12} fw={700} tt="uppercase" c="dimmed" pt={10}>
      {children}
    </Text>
  )
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" mih={40} gap={12}>
      <Text fz={14} c="dimmed">{label}</Text>
      <Text component="div" fz={14} fw={600} ta="right">{children}</Text>
    </Group>
  )
}

function LevelMark({ value }: { value: boolean | null }) {
  if (value === true) return <IconCheck size={18} color="var(--mantine-color-teal-7)" role="img" aria-label="OK" />
  if (value === false) return <IconX size={18} color="var(--mantine-color-red-8)" role="img" aria-label="Défaut" />
  return <span role="img" aria-label="Non vérifié">—</span>
}

const answer = (value: boolean | null, yes: string, no: string) => (value === true ? yes : value === false ? no : '—')

/** Récapitulatif avant validation : une ligne par rubrique, une ligne d'usure par tâche mesurable. */
export function InspectionSummary({ draft, tasks, damages, damageChoice, plannedTasks, config, input, moreRecentEntry }: InspectionSummaryProps) {
  return (
    <Stack gap="sm">
      <Text fw={800} fz={22}>Récapitulatif</Text>
      {moreRecentEntry && <MileageNotAppliedAlert moreRecentEntry={moreRecentEntry} />}
      <Paper withBorder radius="md" px="md" pb="xs">
        <SectionTitle>Relevé</SectionTitle>
        <Row label="Kilométrage">{draft.startMileage != null ? `${humanizeNumber(draft.startMileage)} km` : '—'}</Row>

        <SectionTitle>Niveaux</SectionTitle>
        <Row label="Huile"><LevelMark value={draft.oil} /></Row>
        <Row label="Refroidissement"><LevelMark value={draft.coolant} /></Row>
        <Row label="Lave-glace"><LevelMark value={draft.washer} /></Row>

        <SectionTitle>Usure</SectionTitle>
        {tasks.length === 0 && <Row label="Aucune mesure pour ce type de véhicule">—</Row>}
        {tasks.map((task) => {
          const Icon = taskIcon(task.icon)
          const level = draft.wear[task.id]
          const key = wearZoneKey(level, config)
          const zone = key ? WEAR_ZONES[key] : null
          const ZoneIcon = zone?.icon
          return (
            <Row
              key={task.id}
              label={
                <Group gap={8} wrap="nowrap" component="span">
                  <Icon size={18} aria-hidden />
                  {task.name}
                </Group>
              }
            >
              {zone && ZoneIcon ? (
                <Group gap={6} wrap="nowrap" justify="flex-end" c={key === 'critical' ? 'red.8' : undefined}>
                  <ZoneIcon size={17} color={`var(--mantine-color-${zone.color}-7)`} aria-hidden />
                  {zone.label}
                  {input === 'slider' && <Text component="span" fw={600} c="dimmed">· {level}/10</Text>}
                </Group>
              ) : (
                <Text component="span" c="dimmed" fw={600}>Non mesuré</Text>
              )}
            </Row>
          )
        })}

        <SectionTitle>Contrôles</SectionTitle>
        <Row label="Éclairage">{answer(draft.lightsOk, 'OK', 'Défaut')}</Row>
        <Row label="Dégâts">
          {damageChoice === 'none'
            ? 'Aucun'
            : damageChoice === 'report'
              ? `${damages.length} signalé${damages.length > 1 ? 's' : ''}`
              : '—'}
        </Row>
        <Row label="Essai routier">{answer(draft.roadTestDone, 'Réalisé', 'Non réalisé')}</Row>

        <SectionTitle>À prévoir</SectionTitle>
        {plannedTasks.length === 0 && <Row label="Aucune opération à prévoir">—</Row>}
        {plannedTasks.map((task) => (
          <Row key={task.localId} label={task.name}>
            <IconCalendarPlus size={18} aria-hidden />
          </Row>
        ))}
      </Paper>
    </Stack>
  )
}
