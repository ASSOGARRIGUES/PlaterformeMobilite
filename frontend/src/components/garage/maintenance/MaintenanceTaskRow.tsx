import { ReactNode } from 'react'
import { Avatar, Badge, Group, Progress, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { IconChevronRight, IconHistoryOff, IconPencil } from '@tabler/icons-react'
import { MaintenanceOtherWork, MaintenanceSignalement, MaintenanceTask } from '../../../types/garage'
import { MaintenanceStatusEnum } from '../../../types/schema.d'
import { PeriodicityBadge } from '../PeriodicityBadge'
import { periodicityLabel } from '../periodicityUtils'
import { taskIcon } from './taskIcons'
import { CollapsibleSignalementRow, CollapsibleTaskRow } from './CollapsibleRows'
import {
  CriticalMark,
  DismissButton,
  OnDismiss,
  OpenPhotos,
  OpenSheet,
  PhotoThumb,
  MeasuredLine,
  RealizationLine,
  RowCard,
  SheetLink,
  SignalementBlock,
  SignalementMeta,
} from './TaskRowParts'
import {
  clampProgress,
  initials,
  mainAxisProgress,
  mainFigure,
  measureDrivesStatus,
  secondaryFigure,
  toPlanReason,
} from './maintenanceUtils'
import { useGarageConfig } from '../../../hooks/garage/useGarageConfig'
import { MaintenanceSheetKindEnum } from '../../../types/schema.d'

type MaintenanceTaskRowProps = {
  task: MaintenanceTask
  color: string
  today: string
  showDate: boolean
  /** Mobile : la sous-ligne passe en pleine largeur sous l'en-tête, pour ne pas être écrasée par l'écart à droite */
  stacked?: boolean
  dense?: boolean
  authorOf: (signalement: MaintenanceSignalement) => string
  /** Absent : aucun lien « Fiche #n » (stepper dans la PWA installée) */
  onOpenSheet?: OpenSheet
  onOpenPhotos: OpenPhotos
  onDismiss?: OnDismiss
  /** Emplacement à droite de la ligne principale (bouton « + » du stepper) */
  action?: ReactNode
  /** Carte compacte et dépliable (suggestions du stepper) */
  collapsible?: boolean
}

/** Tâche cyclique : tuile icône · nom · dernière réalisation · écart à l'échéance · barre. */
export function MaintenanceTaskRow(props: MaintenanceTaskRowProps) {
  if (props.collapsible) return <CollapsibleTaskRow {...props} />
  return <FullTaskRow {...props} />
}

function FullTaskRow({ task, color, today, showDate, stacked = false, dense = false, authorOf, onOpenSheet, onOpenPhotos, onDismiss, action }: MaintenanceTaskRowProps) {
  const TaskIcon = taskIcon(task.icon)
  const progress = mainAxisProgress(task)
  const figure = mainFigure(task)
  const secondary = secondaryFigure(task)
  const isUpToDate = task.status === MaintenanceStatusEnum.up_to_date
  const reason = toPlanReason(task)
  const realization = task.last_realization
  // Mesure d'un contrôle plus récente que la pose : elle prévaut (calcul côté API) et la ligne ouvre ce contrôle, pas la fiche de pose.
  const measurement = task.measure_prevails ? task.last_measurement : null
  const { config } = useGarageConfig()
  const measureDrives = !!config && measureDrivesStatus(task, config)
  // Tâche signalée mais jamais réalisée : pas d'échéance calculable, on rappelle pourquoi et la périodicité
  const realizationLine = realization ? (
    <RealizationLine
      date={realization.date}
      km={realization.km}
      wearLevel={realization.wear_level}
      wearIsReason={reason === 'usure'}
      plainWear={task.is_wear_task}
      today={today}
      showDate={showDate}
      sheetLink={measurement ? null : <SheetLink sheetId={realization.sheet_id} onOpenSheet={onOpenSheet} />}
    />
  ) : (
    <Text size="xs" c="dimmed">
      <IconHistoryOff size={14} style={{ verticalAlign: '-3px', marginRight: 4 }} />
      {measurement ? 'Pose jamais enregistrée' : 'Jamais enregistrée'}
      <PeriodicityBadge label={periodicityLabel(task.periodicity)} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
    </Text>
  )
  const measuredLine = measurement && (
    <MeasuredLine
      taskName={task.name}
      measurement={measurement}
      onOpen={onOpenSheet ? () => onOpenSheet(measurement.sheet_id, MaintenanceSheetKindEnum.inspection) : undefined}
    />
  )

  return (
    <RowCard>
      <Stack gap={dense ? 8 : 10}>
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={dense ? 32 : 40} radius="md" variant="light" color={color}>
            <TaskIcon size={dense ? 18 : 22} />
          </ThemeIcon>
          <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text fw={dense ? 600 : 700} size={dense ? 'sm' : 'md'}>{task.name}</Text>
              {task.is_critical && <CriticalMark />}
            </Group>
            {!stacked && <>{realizationLine}{measuredLine}</>}
          </Stack>
          {figure && (
            <Stack
              gap={2}
              align="flex-end"
              px={reason === 'echeance' ? 8 : 0}
              py={reason === 'echeance' ? 4 : 0}
              bg={reason === 'echeance' ? 'orange.0' : undefined}
              style={{
                whiteSpace: 'nowrap',
                ...(reason === 'echeance' && { border: '1px solid var(--mantine-color-orange-5)', borderRadius: 'var(--mantine-radius-sm)' }),
              }}
              aria-label={reason === 'echeance' ? `Raison : échéance, ${figure}` : undefined}
            >
              <Text fw={isUpToDate ? 700 : 800} size={isUpToDate ? 'sm' : 'md'} c={isUpToDate || measureDrives ? 'dimmed' : `${color}.8`}>{figure}</Text>
              {secondary && <Text size="xs" c="dimmed">{secondary}</Text>}
            </Stack>
          )}
          {action}
        </Group>
        {stacked && <>{realizationLine}{measuredLine}</>}
        {progress != null && (
          <Progress size={dense ? 4 : 6} color={color} value={Math.max(4, clampProgress(progress) * 100)} />
        )}
        {task.signalements.map((signalement) => (
          <SignalementBlock
            key={signalement.task_id}
            signalement={signalement}
            author={authorOf(signalement)}
            today={today}
            onOpenSheet={onOpenSheet}
            onOpenPhotos={onOpenPhotos}
            onDismiss={onDismiss}
          />
        ))}
      </Stack>
    </RowCard>
  )
}

/** Tâche suivie jamais enregistrée : carte en pointillés, périodicité. */
export function MaintenanceUnknownRow({ task }: { task: MaintenanceTask }) {
  const TaskIcon = taskIcon(task.icon)
  const periodicity = periodicityLabel(task.periodicity)
  return (
    <RowCard dashed>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={32} radius="md" variant="light" color="gray">
          <TaskIcon size={18} />
        </ThemeIcon>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm">{task.name}</Text>
            {task.is_critical && <CriticalMark />}
          </Group>
          {task.is_wear_task && <Text size="xs" c="dimmed">Aucune pose ni mesure enregistrée</Text>}
          {periodicity && <PeriodicityBadge label={periodicity} style={{ alignSelf: 'flex-start' }} />}
        </Stack>
        <Text size="xs" c="dimmed">{task.is_wear_task ? 'Non renseigné' : 'Inconnu'}</Text>
      </Group>
    </RowCard>
  )
}

/** Signalement autonome (groupe À prévoir) : avatar de l'auteur à la place de la tuile. */
export function MaintenanceSignalementRow(props: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet?: OpenSheet
  onOpenPhotos: OpenPhotos
  onDismiss?: OnDismiss
  action?: ReactNode
  collapsible?: boolean
}) {
  if (props.collapsible) return <CollapsibleSignalementRow {...props} />
  const { signalement, author, today, onOpenSheet, onOpenPhotos, onDismiss, action } = props
  return (
    <RowCard>
      <Group gap="sm" wrap="nowrap">
        <Avatar size={40} radius="md" color="blue">{initials(author)}</Avatar>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600}>{signalement.name}</Text>
          {signalement.description && <Text size="sm">{signalement.description}</Text>}
          <SignalementMeta signalement={signalement} author={author} today={today} onOpenSheet={onOpenSheet} />
        </Stack>
        {signalement.photos.length > 0 && <PhotoThumb photos={signalement.photos} onOpenPhotos={onOpenPhotos} size={44} />}
        <DismissButton signalement={signalement} onDismiss={onDismiss} />
        {action}
      </Group>
    </RowCard>
  )
}

/** Autre travail (non cyclique ou hors catalogue), dans l'Accordion « Autres travaux réalisés ». */
export function MaintenanceOtherWorkRow({ item, today, showDate, onOpenSheet }: {
  item: MaintenanceOtherWork
  today: string
  showDate: boolean
  onOpenSheet: OpenSheet
}) {
  const isFree = item.catalog_task_id == null
  const ItemIcon = isFree ? IconPencil : taskIcon(item.icon)
  return (
    <UnstyledButton onClick={() => onOpenSheet(item.sheet_id)} p={6} style={{ minHeight: 48 }}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={32} radius="md" variant="light" color="gray">
          <ItemIcon size={18} />
        </ThemeIcon>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6}>
            <Text fw={600} size="sm">{item.name}</Text>
            {isFree && <Badge size="xs" variant="light" color="gray">Hors catalogue</Badge>}
          </Group>
          <RealizationLine date={item.date} km={item.km} wearLevel={item.wear_level} today={today} showDate={showDate} />
        </Stack>
        <IconChevronRight size={17} color="var(--mantine-color-gray-5)" />
      </Group>
    </UnstyledButton>
  )
}
