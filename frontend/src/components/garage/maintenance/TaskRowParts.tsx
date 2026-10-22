import { ReactNode } from 'react'
import { Anchor, Avatar, Badge, Button, Group, Image, Paper, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { IconAlertOctagon, IconArrowRight, IconGauge, IconHistory, IconX } from '@tabler/icons-react'
import { humanizeDate, humanizeNumber } from '../../../constants'
import { MaintenanceSignalement } from '../../../types/garage'
import { MaintenanceSheetKindEnum } from '../../../types/schema.d'
import { formatShortDate, initials, sinceLabel } from './maintenanceUtils'
import { formatMeasuredAt } from '../inspection/inspectionConsultUtils'

export type OpenSheet = (sheetId: number, kind?: MaintenanceSheetKindEnum) => void
export type OpenPhotos = (photos: string[]) => void
export type OnDismiss = (signalement: MaintenanceSignalement) => void

/** Lien explicite vers une fiche : les cartes elles-mêmes ne sont pas cliquables. Rien sans `onOpenSheet` (ex. PWA installée dans le stepper). */
export function SheetLink({ sheetId, onOpenSheet, kind = MaintenanceSheetKindEnum.intervention }: { sheetId: number; onOpenSheet?: OpenSheet; kind?: MaintenanceSheetKindEnum }) {
  if (!onOpenSheet) return null
  return (
    <Anchor component="button" inherit fw={600} onClick={() => onOpenSheet(sheetId, kind)}>
      {kind === MaintenanceSheetKindEnum.inspection ? 'Contrôle' : 'Fiche'} #{sheetId} <IconArrowRight size={12} style={{ verticalAlign: '-2px' }} />
    </Anchor>
  )
}

export function RowCard({ dashed = false, children }: { dashed?: boolean; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="sm" bg={dashed ? 'gray.0' : undefined} style={{ borderStyle: dashed ? 'dashed' : undefined }}>
      {children}
    </Paper>
  )
}

const CRITICAL_LABEL = 'Tâche critique : bloque le véhicule si elle est dépassée.'

/** Panneau STOP : une tâche critique dépassée immobilise le véhicule (blocage automatique : Epic 4). */
export function CriticalMark() {
  return (
    <Tooltip label={CRITICAL_LABEL} events={{ hover: true, focus: true, touch: true }} multiline w={220}>
      <IconAlertOctagon size={16} color="var(--mantine-color-red-7)" aria-label={CRITICAL_LABEL} style={{ flexShrink: 0 }} />
    </Tooltip>
  )
}

/** Pastille « État n/10 » ; encadrée quand l'état de la pièce explique la présence dans « À prévoir ». */
export function WearBadge({ wearLevel, wearIsReason = false, inline = true }: { wearLevel: number; wearIsReason?: boolean; inline?: boolean }) {
  return (
    <Badge
      size="sm"
      variant={wearIsReason ? 'outline' : 'light'}
      color={wearIsReason ? 'orange' : 'gray'}
      tt="none"
      ml={inline ? 6 : 0}
      style={inline ? { verticalAlign: 'middle' } : { flexShrink: 0 }}
      aria-label={wearIsReason ? `Raison : état de la pièce, ${wearLevel}/10` : undefined}
    >
      État {wearLevel}/10
    </Badge>
  )
}

/** Sous-ligne : ⟲ [date] · il y a 4 mois · 128 000 km · Fiche #41 → [État 4/10]. */
export function RealizationLine({ date, km, wearLevel, wearIsReason = false, plainWear = false, today, showDate, sheetLink }: {
  date: string
  km: number | null
  wearLevel?: number | null
  /** L'état de la pièce explique la présence dans « À prévoir » : pastille encadrée */
  wearIsReason?: boolean
  /** Ligne d'usure : l'état de la pose reste en texte simple (« Usure 10/10 ») tant qu'il n'explique pas le statut. */
  plainWear?: boolean
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
      {wearLevel != null && (plainWear && !wearIsReason ? <> · Usure {wearLevel}/10</> : <WearBadge wearLevel={wearLevel} wearIsReason={wearIsReason} />)}
    </Text>
  )
}

/** « Mesuré à 5/10 le 3 oct. » : la mesure d'un contrôle qui prévaut sur la dernière pose ; ouvre ce contrôle (une seule cible par ligne). */
export function MeasuredLine({ taskName, measurement, onOpen }: {
  taskName: string
  measurement: { sheet_id: number; date: string; level: number }
  onOpen?: () => void
}) {
  const label = `Mesuré à ${measurement.level}/10 le ${formatMeasuredAt(measurement.date)}`
  const content = (
    <Group gap={5} wrap="nowrap">
      <IconGauge size={15} color="var(--mantine-color-dimmed)" aria-hidden style={{ flexShrink: 0 }} />
      <Text size="xs" fw={700} component="span">{label}</Text>
      {onOpen && <IconArrowRight size={12} aria-hidden />}
    </Group>
  )
  if (!onOpen) return content
  return (
    <UnstyledButton
      onClick={onOpen}
      mih={44}
      aria-label={`${taskName}, ouvrir le contrôle du ${humanizeDate(measurement.date)} : ${label}`}
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {content}
    </UnstyledButton>
  )
}

export function PhotoThumb({ photos, onOpenPhotos, size }: { photos: string[]; onOpenPhotos: OpenPhotos; size: number }) {
  return (
    <UnstyledButton
      aria-label="Voir la photo"
      onClick={() => onOpenPhotos(photos)}
    >
      <Image src={photos[0]} w={size} h={size} radius="sm" fit="cover" alt="" />
    </UnstyledButton>
  )
}

/** « Sim Gal · 15/07 · Fiche #10 → » ou « Contrôle #12 → » selon le genre de fiche. */
export function SignalementMeta({ signalement, author, today, onOpenSheet }: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet?: OpenSheet
}) {
  return (
    <Text size="xs" c="dimmed">
      {[author, formatShortDate(signalement.sheet_date, today)].filter(Boolean).join(' · ')}
      {onOpenSheet && <> · <SheetLink sheetId={signalement.sheet_id} kind={signalement.sheet_kind} onOpenSheet={onOpenSheet} /></>}
    </Text>
  )
}

/** Bouton « Écarter » : rendu seulement si l'utilisateur peut gérer les interventions (onDismiss défini). */
export function DismissButton({ signalement, onDismiss }: { signalement: MaintenanceSignalement; onDismiss?: OnDismiss }) {
  if (!onDismiss) return null
  return (
    <Button variant="subtle" color="gray" size="compact-sm" mih={44} leftSection={<IconX size={14} />} onClick={() => onDismiss(signalement)}>
      Écarter
    </Button>
  )
}

/** Signalement rattaché à une tâche : encadré dans la carte de la tâche (jamais en double). */
export function SignalementBlock({ signalement, author, today, onOpenSheet, onOpenPhotos, onDismiss }: {
  signalement: MaintenanceSignalement
  author: string
  today: string
  onOpenSheet?: OpenSheet
  onOpenPhotos: OpenPhotos
  onDismiss?: OnDismiss
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
        <DismissButton signalement={signalement} onDismiss={onDismiss} />
      </Group>
    </Paper>
  )
}
