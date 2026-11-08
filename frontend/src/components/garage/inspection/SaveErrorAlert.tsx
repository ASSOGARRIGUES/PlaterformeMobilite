import { Alert, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconAlertCircle, IconChevronRight, IconCloudX } from '@tabler/icons-react'
import { GroupedFieldError } from '../../../hooks/garage/inspectionStepperUtils'

export type StepErrorState = {
  /** Message lisible de repli (corps non structuré, erreur sans champ). */
  message: string
  /** Réseau ou 5xx : la saisie est valide, « Réessayer » suffit. */
  retryable: boolean
  fields: GroupedFieldError[]
}

type SaveErrorAlertProps = {
  error: StepErrorState
  /** Variante une ligne (étape Usure, où chaque pixel de hauteur compte). */
  compact?: boolean
  onFix: (step: number) => void
}

/** Erreur d'enregistrement ancrée au-dessus de la barre de navigation, près du pouce. */
export function SaveErrorAlert({ error, compact = false, onFix }: SaveErrorAlertProps) {
  if (error.retryable) {
    return (
      <Alert color="red" variant="light" icon={<IconCloudX size={20} />} mx="md" mb={compact ? 8 : 10} p={compact ? '8px 12px' : undefined} style={{ flexShrink: 0 }}>
        {compact ? (
          <Text fz={14} fw={700} c="red.8">Non enregistré. Touchez « Réessayer ».</Text>
        ) : (
          <Stack gap={2}>
            <Text fz={14} fw={700} c="red.8">Étape non enregistrée</Text>
            <Text fz={13.5}>La connexion a échoué. Vos saisies sont gardées sur cet écran : touchez « Réessayer ».</Text>
          </Stack>
        )}
      </Alert>
    )
  }

  const fixable = error.fields.filter((field) => field.label)
  if (fixable.length === 0) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={20} />} mx="md" mb={10} style={{ flexShrink: 0 }}>
        <Text fz={14}>{error.message}</Text>
      </Alert>
    )
  }

  const title = `${fixable.length} information${fixable.length > 1 ? 's' : ''} à corriger`
  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={20} />} mx="md" mb={10} title={title} style={{ flexShrink: 0 }}>
      <Stack gap={0}>
        {fixable.map((field) => (
          <UnstyledButton
            key={field.field}
            mih={48}
            disabled={field.step == null}
            onClick={() => field.step != null && onFix(field.step)}
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Group justify="space-between" wrap="nowrap" gap={8}>
              <Text fz={14}>
                <b>{field.label}</b> : {field.message}
              </Text>
              {field.step != null && (
                <Group gap={2} wrap="nowrap" c="cyan.8" style={{ flexShrink: 0 }}>
                  <Text fz={14} fw={700}>Corriger</Text>
                  <IconChevronRight size={16} aria-hidden />
                </Group>
              )}
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Alert>
  )
}
