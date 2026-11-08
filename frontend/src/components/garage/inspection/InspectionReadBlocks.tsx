import { ReactNode } from 'react'
import { Badge, Box, Group, Image, Paper, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import {
  IconAlertTriangle,
  IconBulb,
  IconBulbOff,
  IconCalendarOff,
  IconCalendarPlus,
  IconCircleCheck,
  IconCircleX,
  IconClipboardOff,
  IconPencil,
  IconRoad,
} from '@tabler/icons-react'
import { InspectionDamage, LocalTask } from '../../../types/garage'
import { plural } from '../../../constants'
import { PeriodicityBadge } from '../PeriodicityBadge'
import { SectionId } from './InspectionHighlights'

/** Carte de section ; `data-anchor` sert au défilement depuis « À retenir » et depuis la barre d'erreurs. */
export function InspectionSection({ id, title, right, children }: { id: SectionId; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Paper component="section" withBorder radius="md" p="sm" data-anchor={id} aria-labelledby={`insp-${id}`} style={{ scrollMarginTop: 72 }}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Title order={3} size="h5" id={`insp-${id}`}>{title}</Title>
          {right}
        </Group>
        {children}
      </Stack>
    </Paper>
  )
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Group gap={8} c="dimmed">
      {icon}
      <Text fz={14} c="dimmed">{children}</Text>
    </Group>
  )
}

export const NoWear = () => <Empty icon={<IconClipboardOff size={19} aria-hidden />}>Aucune mesure pour ce type de véhicule</Empty>
export const NoWearOnSheet = () => <Empty icon={<IconClipboardOff size={19} aria-hidden />}>Aucune mesure sur cette fiche</Empty>

type BinaryReadProps = {
  /** true = OK / Réalisé, false = Défaut / Non réalisé, null = non renseigné. */
  value: boolean | null | undefined
  okLabel?: string
  koLabel?: string
  okIcon?: typeof IconCircleCheck
  koIcon?: typeof IconCircleX
  /** Un « non » n'est pas un défaut (essai non réalisé) : gris au lieu de rouge. */
  koNeutral?: boolean
  note?: string | null
}

export function BinaryRead({ value, okLabel = 'OK', koLabel = 'Défaut', okIcon: OkIcon = IconCircleCheck, koIcon: KoIcon = IconCircleX, koNeutral = false, note }: BinaryReadProps) {
  const ok = value === true
  const Icon = ok ? OkIcon : KoIcon
  const color = ok ? 'teal.7' : koNeutral ? 'dimmed' : 'red.8'
  return (
    <Stack gap={6}>
      <Group gap={8} c={color}>
        <Icon size={22} aria-hidden />
        <Text fz={15} fw={700} c={color}>{value == null ? 'Non renseigné' : ok ? okLabel : koLabel}</Text>
      </Group>
      {note && <Box bg="gray.0" p="xs" style={{ borderRadius: 8 }}><Text fz={14}>{note}</Text></Box>}
    </Stack>
  )
}

export const LightingRead = ({ ok, notes }: { ok: boolean | null | undefined; notes: string | undefined }) => (
  <BinaryRead value={ok} okIcon={IconBulb} koIcon={IconBulbOff} note={ok === false ? notes : null} />
)

export const RoadTestRead = ({ done, notes }: { done: boolean | null | undefined; notes: string | undefined }) => (
  <BinaryRead value={done} okLabel="Réalisé" koLabel="Non réalisé" okIcon={IconRoad} koIcon={IconCircleX} koNeutral note={done === true ? notes : null} />
)

export type OpenPhoto = (photos: string[], index: number) => void

export function PhotoThumbs({ urls, label, size, onOpen }: { urls: string[]; label: string; size: number; onOpen: OpenPhoto }) {
  if (!urls.length) return null
  return (
    <Group gap="xs">
      {urls.map((url, index) => (
        <UnstyledButton key={url} aria-label={`Agrandir ${label}, photo ${index + 1} sur ${urls.length}`} onClick={() => onOpen(urls, index)} style={{ cursor: 'zoom-in' }}>
          <Image src={url} w={size} h={size} radius={4} fit="cover" alt="" />
        </UnstyledButton>
      ))}
    </Group>
  )
}

export function DamagesRead({ damages, onOpenPhoto }: { damages: InspectionDamage[]; onOpenPhoto: OpenPhoto }) {
  if (!damages.length) return <Empty icon={<IconCircleCheck size={19} color="var(--mantine-color-teal-7)" aria-hidden />}>Aucun dégât</Empty>
  return (
    <Stack gap="sm">
      {damages.map((damage, index) => (
        <Paper key={damage.id} withBorder radius="md" p="sm">
          <Stack gap="xs">
            <Group gap={8} wrap="nowrap">
              <IconAlertTriangle size={19} color="var(--mantine-color-orange-7)" aria-hidden />
              <Text fw={700}>Dégât {index + 1}</Text>
              {damage.photos.length > 0 && <Text fz={12.5} c="dimmed" ml="auto">{damage.photos.length} {plural(damage.photos.length, 'photo', 'photos')}</Text>}
            </Group>
            <Text fz={14} lh={1.45}>{damage.description}</Text>
            <PhotoThumbs urls={damage.photos.map((photo) => photo.url)} label={`dégât ${index + 1}`} size={80} onOpen={onOpenPhoto} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

export function OpsRead({ tasks, onOpenPhoto }: { tasks: LocalTask[]; onOpenPhoto: OpenPhoto }) {
  if (!tasks.length) return <Empty icon={<IconCalendarOff size={19} aria-hidden />}>Aucune opération à prévoir</Empty>
  return (
    <Stack gap={0}>
      {tasks.map((task, index) => {
        const Icon = task.catalogTaskId === undefined ? IconPencil : IconCalendarPlus
        return (
          <Stack key={task.serverId ?? index} gap={6} py={10} style={index > 0 ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}>
            <Group gap={8}>
              <Icon size={19} color="var(--mantine-color-dimmed)" aria-hidden />
              <Text fz={15} fw={700}>{task.name}</Text>
              <PeriodicityBadge label={task.periodicityLabel} />
              {task.catalogTaskId === undefined && <Badge size="xs" variant="light" color="gray">Hors catalogue</Badge>}
            </Group>
            {task.description && <Text fz={13.5} lh={1.45} pl={27}>{task.description}</Text>}
            <Box pl={27}>
              <PhotoThumbs urls={task.photos} label={task.name} size={64} onOpen={onOpenPhoto} />
            </Box>
          </Stack>
        )
      })}
    </Stack>
  )
}
