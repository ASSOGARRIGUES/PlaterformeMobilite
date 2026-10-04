import { ReactNode } from 'react'
import { Anchor, Avatar, Badge, Group, Image, Paper, Progress, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core'
import { IconAlertOctagon, IconArrowRight, IconChevronRight, IconHistory, IconHistoryOff, IconPencil } from '@tabler/icons-react'
import { humanizeDate, humanizeNumber } from '../../../constants'
import { MaintenanceOtherWork, MaintenanceSignalement, MaintenanceTask } from '../../../types/garage'
import { MaintenanceStatusEnum } from '../../../types/schema.d'
import { taskIcon } from './taskIcons'
import {
  clampProgress,
  formatShortDate,
  initials,
  mainAxisProgress,
  mainFigure,
  periodicityLabel,
  secondaryFigure,
  sinceLabel,
  toPlanReason,
} from './maintenanceUtils'

type OpenSheet = (sheetId: number) => void
type OpenPhotos = (photos: string[]) => void

/** Lien explicite vers une fiche : les cartes elles-mêmes ne sont pas cliquables. */
function SheetLink({ sheetId, onOpenSheet }: { sheetId: number; onOpenSheet: OpenSheet }) {
  return (
    <Anchor component="button" inherit fw={600} onClick={() => onOpenSheet(sheetId)}>
      Fiche #{sheetId} <IconArrowRight size={12} style={{ verticalAlign: '-2px' }} />
    </Anchor>
  )
}

function RowCard({ dashed = false, children }: { dashed?: boolean; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="sm" bg={dashed ? 'gray.0' : undefined} style={{ borderStyle: dashed ? 'dashed' : undefined }}>
      {children}
    </Paper>
  )
}

const CRITICAL_LABEL = 'Tâche critique : bloque le véhicule si elle est dépassée.'

/** Panneau STOP : une tâche critique dépassée immobilise le véhicule (blocage automatique : Epic 4). */
function CriticalMark() {
  return (
    <Tooltip label={CRITICAL_LABEL} events={{ hover: true, focus: true, touch: true }} multiline w={220}>
      <IconAlertOctagon size={16} color="var(--mantine-color-red-7)" aria-label={CRITICAL_LABEL} style={{ flexShrink: 0 }} />
    </Tooltip>
  )
}

/** Sous-ligne : ⟲ [date] · il y a 4 mois · 128 000 km · Fiche #41 → [État 4/10]. */
function RealizationLine({ date, km, wearLevel, wearIsReason = false, today, showDate, sheetLink }: {
  date: string
  km: number | null
  wearLevel?: number | null
  /** L'état de la pièce explique la présence dans « À prévoir » : pastille encadrée */
  wearIsReason?: boolean
  today: string
  showDate: boolean
  sheetLink?: ReactNode
}) {
  const parts = [showDate ? humanizeDate(date) : null, sinceLabel(date, today), km != null ? `${humanizeNumber(km)} km` : null]
  // Un seul flux de texte : si la ligne se coupe, le lien suit avec l'interligne normal
  return (
    <Text size="xs" c="dimmed" component="div">
      <IconHistory size={14} style={{ verticalAlign: '-3px', marginRight: 4 }} />
      {parts.filter(Boolean).join(' · ')}
      {sheetLink && <> · {sheetLink}</>}
      {wearLevel != null && (
        <Badge
          size="sm"
          variant={wearIsReason ? 'outline' : 'light'}
          color={wearIsReason ? 'orange' : 'gray'}
          tt="none"
          ml={6}
          style={{ verticalAlign: 'middle' }}
          aria-label={wearIsReason ? `Raison : état de la pièce, ${wearLevel}/10` : undefined}
        >
          État {wearLevel}/10
        </Badge>
      )}
    </Text>
  )
}

function PhotoThumb({ photos, onOpenPhotos, size }: { photos: string[]; onOpenPhotos: OpenPhotos; size: number }) {
  return (
    <UnstyledButton
      aria-label="Voir la photo"
      onClick={() => onOpenPhotos(photos)}
    >
      <Image src={photos[0]} w={size} h={size} radius="sm" fit="cover" alt="" />
    </UnstyledButton>
  )
}

/** « Sim Gal · 15/07 · Fiche #10 → » */
function SignalementMeta({ signalement, author, today, onOpenSheet }: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet: OpenSheet
}) {
  return (
    <Text size="xs" c="dimmed">
      {[author, formatShortDate(signalement.sheet_date, today)].filter(Boolean).join(' · ')} · <SheetLink sheetId={signalement.sheet_id} onOpenSheet={onOpenSheet} />
    </Text>
  )
}

/** Signalement rattaché à une tâche : encadré dans la carte de la tâche (jamais en double). */
function AttachedSignalement({ signalement, author, today, onOpenSheet, onOpenPhotos }: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet: OpenSheet
  onOpenPhotos: OpenPhotos
}) {
  return (
    <Paper bg="gray.0" radius="sm" p="xs">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Avatar size={28} radius="xl" color="blue">{initials(author)}</Avatar>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600}>{signalement.description || 'À faire au prochain passage'}</Text>
          <SignalementMeta signalement={signalement} author={author} today={today} onOpenSheet={onOpenSheet} />
        </Stack>
        {signalement.photos.length > 0 && <PhotoThumb photos={signalement.photos} onOpenPhotos={onOpenPhotos} size={44} />}
      </Group>
    </Paper>
  )
}

type MaintenanceTaskRowProps = {
  task: MaintenanceTask
  color: string
  today: string
  showDate: boolean
  /** Mobile : la sous-ligne passe en pleine largeur sous l'en-tête, pour ne pas être écrasée par l'écart à droite */
  stacked?: boolean
  dense?: boolean
  authorOf: (sheetId: number) => string
  onOpenSheet: OpenSheet
  onOpenPhotos: OpenPhotos
}

/** Tâche cyclique : tuile icône · nom · dernière réalisation · écart à l'échéance · barre. */
export function MaintenanceTaskRow({ task, color, today, showDate, stacked = false, dense = false, authorOf, onOpenSheet, onOpenPhotos }: MaintenanceTaskRowProps) {
  const TaskIcon = taskIcon(task.icon)
  const progress = mainAxisProgress(task)
  const figure = mainFigure(task)
  const secondary = secondaryFigure(task)
  const isUpToDate = task.status === MaintenanceStatusEnum.up_to_date
  const reason = toPlanReason(task)
  const realization = task.last_realization
  // Tâche signalée mais jamais réalisée : pas d'échéance calculable, on rappelle pourquoi et la périodicité
  const neverRecorded = ['Jamais enregistrée', periodicityLabel(task)].filter(Boolean).join(' · ')
  const realizationLine = realization ? (
    <RealizationLine
      date={realization.date}
      km={realization.km}
      wearLevel={realization.wear_level}
      wearIsReason={reason === 'usure'}
      today={today}
      showDate={showDate}
      sheetLink={<SheetLink sheetId={realization.sheet_id} onOpenSheet={onOpenSheet} />}
    />
  ) : (
    <Text size="xs" c="dimmed">
      <IconHistoryOff size={14} style={{ verticalAlign: '-3px', marginRight: 4 }} />
      {neverRecorded}
    </Text>
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
            {!stacked && realizationLine}
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
              <Text fw={isUpToDate ? 700 : 800} size={isUpToDate ? 'sm' : 'md'} c={isUpToDate ? 'dimmed' : `${color}.8`}>{figure}</Text>
              {secondary && <Text size="xs" c="dimmed">{secondary}</Text>}
            </Stack>
          )}
        </Group>
        {stacked && realizationLine}
        {progress != null && (
          <Progress size={dense ? 4 : 6} color={color} value={Math.max(4, clampProgress(progress) * 100)} />
        )}
        {task.signalements.map((signalement) => (
          <AttachedSignalement
            key={signalement.task_id}
            signalement={signalement}
            author={authorOf(signalement.sheet_id)}
            today={today}
            onOpenSheet={onOpenSheet}
            onOpenPhotos={onOpenPhotos}
          />
        ))}
      </Stack>
    </RowCard>
  )
}

/** Tâche suivie jamais enregistrée : carte en pointillés, périodicité. */
export function MaintenanceUnknownRow({ task }: { task: MaintenanceTask }) {
  const TaskIcon = taskIcon(task.icon)
  const periodicity = periodicityLabel(task)
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
          {periodicity && <Text size="xs" c="dimmed">{periodicity}</Text>}
        </Stack>
        <Text size="xs" c="dimmed">Inconnu</Text>
      </Group>
    </RowCard>
  )
}

/** Signalement autonome (groupe À prévoir) : avatar de l'auteur à la place de la tuile. */
export function MaintenanceSignalementRow({ signalement, author, today, onOpenSheet, onOpenPhotos }: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet: OpenSheet
  onOpenPhotos: OpenPhotos
}) {
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
