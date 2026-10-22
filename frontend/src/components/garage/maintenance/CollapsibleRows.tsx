import { Children, ReactNode, useState } from 'react'
import { Avatar, Collapse, Group, Paper, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconPhoto } from '@tabler/icons-react'
import { MaintenanceSignalement, MaintenanceTask } from '../../../types/garage'
import { PeriodicityBadge } from '../PeriodicityBadge'
import { periodicityLabel } from '../periodicityUtils'
import { taskIcon } from './taskIcons'
import {
  CriticalMark,
  OpenPhotos,
  OpenSheet,
  PhotoThumb,
  RealizationLine,
  SheetLink,
  SignalementBlock,
  SignalementMeta,
} from './TaskRowParts'
import { formatShortDate, initials, mainFigure, secondaryFigure, toPlanReason } from './maintenanceUtils'

/**
 * Carte dépliable : l'en-tête (zone tactile ≥ 44 px) bascule le dépliant, l'action reste à côté (jamais un bouton dans un bouton).
 * Chaque élément de `details` porte sa propre condition (`cond && <X />`) ; sans élément affiché, la carte n'est pas dépliable.
 */
function CollapsibleCard({ color, header, details, action }: { color: string; header: ReactNode; details: ReactNode[]; action?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const shownDetails = Children.toArray(details)
  const expandable = shownDetails.length > 0
  return (
    // Le statut se lit par la bande de couleur (pas d'en-tête de groupe dans le stepper)
    <Paper withBorder radius="md" p="xs" style={{ borderLeft: `4px solid var(--mantine-color-${color}-6)` }}>
      <Group gap="xs" wrap="nowrap" align="center">
        <UnstyledButton
          component={expandable ? 'button' : 'div'}
          onClick={expandable ? () => setOpen((value) => !value) : undefined}
          aria-expanded={expandable ? open : undefined}
          style={{ flex: 1, minWidth: 0, minHeight: 40, display: 'flex', alignItems: 'center', cursor: expandable ? undefined : 'default' }}
        >
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>{header}</Stack>
            {expandable && (
              <IconChevronDown
                size={16}
                color="var(--mantine-color-gray-6)"
                style={{ flexShrink: 0, transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : undefined }}
              />
            )}
          </Group>
        </UnstyledButton>
        {action}
      </Group>
      {expandable && (
        <Collapse in={open}>
          <Stack gap="xs" pt="xs">{shownDetails}</Stack>
        </Collapse>
      )}
    </Paper>
  )
}

/** Suggestion cyclique : deux lignes (nom + raison / écart + dernière réalisation) ; le reste dans le dépliant. */
export function CollapsibleTaskRow({ task, color, today, authorOf, onOpenSheet, onOpenPhotos, action }: {
  task: MaintenanceTask
  color: string
  today: string
  authorOf: (signalement: MaintenanceSignalement) => string
  onOpenSheet?: OpenSheet
  onOpenPhotos: OpenPhotos
  action?: ReactNode
}) {
  const TaskIcon = taskIcon(task.icon)
  const figure = mainFigure(task)
  const secondary = secondaryFigure(task)
  const reason = toPlanReason(task)
  const realization = task.last_realization
  const [firstSignalement] = task.signalements

  const header = (
    <>
      <Group gap={6} wrap="nowrap">
        <ThemeIcon size={22} radius="sm" variant="light" color={color}>
          <TaskIcon size={14} />
        </ThemeIcon>
        <Text fw={700} size="sm" truncate="end" style={{ minWidth: 0 }}>{task.name}</Text>
        {task.is_critical && <CriticalMark />}
        {figure && <Text fw={800} size="xs" c={`${color}.8`} ml="auto" style={{ whiteSpace: 'nowrap' }}>{figure}</Text>}
      </Group>
      {realization ? (
        <RealizationLine date={realization.date} km={realization.km} wearLevel={realization.wear_level} wearIsReason={reason === 'usure'} today={today} showDate={false} />
      ) : (
        <Text size="xs" c="dimmed">Jamais enregistrée</Text>
      )}
      {firstSignalement && (
        <Group gap={6} wrap="nowrap">
          <Avatar size={16} radius="xl" color="blue" styles={{ placeholder: { fontSize: 7 } }}>{initials(authorOf(firstSignalement))}</Avatar>
          <Text size="xs" c="dimmed" truncate="end">{firstSignalement.description || 'À faire au prochain passage'}</Text>
        </Group>
      )}
    </>
  )

  const periodicity = periodicityLabel(task.periodicity)
  const meta = [
    secondary && <Text key="secondary" size="xs" c="dimmed">{secondary}</Text>,
    realization && onOpenSheet && <Text key="sheet" size="xs" component="div"><SheetLink sheetId={realization.sheet_id} onOpenSheet={onOpenSheet} /></Text>,
    periodicity && <PeriodicityBadge key="periodicity" label={periodicity} />,
  ].filter(Boolean)
  const details = [
    meta.length > 0 && <Group key="meta" gap="xs" wrap="wrap">{meta}</Group>,
    ...task.signalements.map((signalement) => (
      <SignalementBlock
        key={signalement.task_id}
        signalement={signalement}
        author={authorOf(signalement)}
        today={today}
        onOpenSheet={onOpenSheet}
        onOpenPhotos={onOpenPhotos}
      />
    )),
  ]

  return <CollapsibleCard color={color} header={header} details={details} action={action} />
}

/** Signalement autonome : avatar de l'auteur à la place de la tuile, description complète dans le dépliant. */
export function CollapsibleSignalementRow({ signalement, author, today, onOpenSheet, onOpenPhotos, action }: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet?: OpenSheet
  onOpenPhotos: OpenPhotos
  action?: ReactNode
}) {
  const header = (
    <Group gap={8} wrap="nowrap">
      <Avatar size={22} radius="sm" color="blue" styles={{ placeholder: { fontSize: 10 } }}>{initials(author)}</Avatar>
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Text fw={700} size="sm" truncate="end">{signalement.name}</Text>
        <Text size="xs" c="dimmed" truncate="end">
          {['Signalement', author, formatShortDate(signalement.sheet_date, today)].filter(Boolean).join(' · ')}
        </Text>
      </Stack>
      {signalement.photos.length > 0 && <IconPhoto size={16} color="var(--mantine-color-gray-6)" aria-label="Photos jointes" style={{ flexShrink: 0 }} />}
    </Group>
  )

  const details = [
    signalement.description && <Text key="description" size="sm">{signalement.description}</Text>,
    <SignalementMeta key="meta" signalement={signalement} author={author} today={today} onOpenSheet={onOpenSheet} />,
    signalement.photos.length > 0 && (
      <Group key="photos" gap="xs">
        <PhotoThumb photos={signalement.photos} onOpenPhotos={onOpenPhotos} size={56} />
      </Group>
    ),
  ]

  return <CollapsibleCard color="orange" header={header} details={details} action={action} />
}
