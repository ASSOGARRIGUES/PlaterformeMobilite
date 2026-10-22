import { ReactNode } from 'react'
import { Alert, Box, Button, Group, Loader, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconChevronRight, IconCloudCheck, IconCloudX, IconPencil, IconRefresh, IconAlertCircle } from '@tabler/icons-react'
import { plural } from '../../../constants'
import { GroupStatus, useSaveEngine } from '../../../hooks/garage/useSaveEngine'

type Engine = ReturnType<typeof useSaveEngine>

/** Fait défiler jusqu'au champ (`data-field`) en erreur : bandeau mobile et carte desktop. */
export function scrollToField(group: string) {
  document.querySelector(`[data-field="${group}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function FieldStatus({ status }: { status: GroupStatus | undefined }) {
  if (!status) return null
  if (status.state === 'saving') {
    return (
      <Group gap={5} wrap="nowrap" role="status">
        <Loader size="xs" color="gray" />
        <Text fz={12.5} fw={700} c="dimmed">Enregistrement…</Text>
      </Group>
    )
  }
  if (status.state === 'saved') {
    return (
      <Group gap={5} wrap="nowrap" role="status">
        <IconCloudCheck size={16} color="var(--mantine-color-teal-7)" aria-hidden />
        <Text fz={12.5} fw={700}>Enregistré</Text>
      </Group>
    )
  }
  return (
    <Group gap={5} wrap="nowrap" role="status">
      <IconCloudX size={16} color="var(--mantine-color-red-7)" aria-hidden />
      <Text fz={12.5} fw={700} c="red.8">Non enregistré</Text>
    </Group>
  )
}

type EditFieldProps = {
  engine: Engine
  /** Groupes affichés par ce champ (un champ peut en regrouper plusieurs : les trois niveaux). */
  groups: string[]
  label?: string
  /** Faux : l'enfant cercle lui-même la case en erreur (niveaux). */
  ring?: boolean
  children: ReactNode
}

/** Champ éditable : état « Enregistrement… / Enregistré / Non enregistré », cerclé de rouge et alerte + « Réessayer » en cas d'échec. */
export function EditField({ engine, groups, label, ring = true, children }: EditFieldProps) {
  const statuses = groups.map((group) => ({ group, status: engine.status[group] })).filter((entry) => entry.status)
  const failed = statuses.filter((entry) => entry.status?.state === 'error')
  const shown = failed[0]?.status ?? statuses.find((entry) => entry.status?.state === 'saving')?.status ?? statuses.find((entry) => entry.status?.state === 'saved')?.status
  return (
    <Stack gap={6} data-field={groups[0]} style={{ scrollMarginTop: 120 }}>
      {(label || shown) && (
        <Group justify="space-between" wrap="nowrap" mih={20}>
          {label ? <Text fz={12.5} fw={700} c="dimmed">{label}</Text> : <span />}
          <FieldStatus status={shown} />
        </Group>
      )}
      <Box style={ring && failed.length ? { boxShadow: '0 0 0 2px var(--mantine-color-red-6)', borderRadius: 14 } : undefined}>{children}</Box>
      {failed.map(({ group, status }) => {
        if (status?.state !== 'error') return null
        const { error } = status
        return (
          <Alert key={group} color="red" variant="light" role="alert" icon={error.retryable ? <IconCloudX size={20} /> : <IconAlertCircle size={20} />} p="xs">
            <Text fz={13.5} fw={700} c="red.8" lh={1.4}>{error.reason} Valeur rétablie : {error.restored}.</Text>
            <Text fz={13} mt={2}>Votre modification : {error.attempted}</Text>
            {error.retryable && (
              <Button variant="outline" color="red" bg="white" mih={48} mt={8} leftSection={<IconRefresh size={18} />} onClick={() => engine.retry(group)}>
                Réessayer
              </Button>
            )}
          </Alert>
        )
      })}
    </Stack>
  )
}

/** Barre « Chaque changement est enregistré aussitôt » avec l'état global ; collante en mobile. */
export function EditBar({ engine, desk = false }: { engine: Engine; desk?: boolean }) {
  const status: GroupStatus = engine.saving ? { state: 'saving' } : engine.errors.length ? { state: 'error', error: engine.errors[0] } : { state: 'saved' }
  return (
    <Paper
      role="status"
      bg="cyan.0"
      px="sm"
      py={10}
      radius="md"
      style={{ border: '1px solid var(--mantine-color-cyan-2)', position: desk ? 'static' : 'sticky', top: desk ? undefined : 8, zIndex: 4 }}
    >
      <Group gap={8} wrap="nowrap">
        <IconPencil size={17} color="var(--mantine-color-cyan-9)" aria-hidden />
        <Text fz={13} lh={1.3} style={{ flex: 1 }}>Chaque changement est enregistré aussitôt.</Text>
        {engine.saving || engine.errors.length ? <FieldStatus status={status} /> : (
          <Group gap={5} wrap="nowrap">
            <IconCloudCheck size={16} color="var(--mantine-color-teal-7)" aria-hidden />
            <Text fz={12.5} fw={700}>{engine.anySaved ? 'Enregistré' : 'À jour'}</Text>
          </Group>
        )}
      </Group>
    </Paper>
  )
}

/** Mobile : bandeau collant en bas « 1 modification non enregistrée : Lave-glace · Voir ». */
export function ErrorDock({ engine }: { engine: Engine }) {
  if (!engine.errors.length) return null
  const names = engine.errors.map((error) => error.label.split(' · ').slice(-1)[0]).join(', ')
  return (
    <Paper
      role="alert"
      withBorder
      shadow="md"
      radius={12}
      py={6}
      pr={6}
      pl="sm"
      style={{ position: 'sticky', bottom: 10, zIndex: 5, borderColor: 'var(--mantine-color-red-6)' }}
    >
      <Group gap={10} wrap="nowrap">
        <IconCloudX size={20} color="var(--mantine-color-red-7)" aria-hidden />
        <Text fz={13.5} lh={1.35} style={{ flex: 1, minWidth: 0 }}>
          <Text component="span" fw={700} c="red.8" inherit>
            {engine.errors.length} {plural(engine.errors.length, 'modification non enregistrée', 'modifications non enregistrées')}
          </Text>
          {' : '}{names}
        </Text>
        <Button variant="outline" mih={48} onClick={() => scrollToField(engine.errors[0].group)}>Voir</Button>
      </Group>
    </Paper>
  )
}

/** Desktop : la carte de droite liste les champs en erreur, cliquables. */
export function ErrorList({ engine }: { engine: Engine }) {
  if (!engine.errors.length) return null
  return (
    <Stack gap={6}>
      {engine.errors.map((error) => (
        <UnstyledButton key={error.group} mih={40} px="sm" bg="red.0" onClick={() => scrollToField(error.group)} style={{ borderRadius: 8 }}>
          <Group gap={8} wrap="nowrap">
            <IconCloudX size={17} color="var(--mantine-color-red-7)" aria-hidden />
            <Text fz={13.5} fw={700} c="red.8" style={{ flex: 1 }}>{error.label}</Text>
            <IconChevronRight size={16} aria-hidden />
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  )
}
