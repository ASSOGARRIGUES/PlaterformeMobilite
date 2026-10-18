import { Box, Group, Progress, Text } from '@mantine/core'
import { SaveState, SaveStatus } from './SaveStatus'

type InspectionProgressProps = {
  /** Étape affichée, 0-based. */
  step: number
  total: number
  saveState: SaveState
}

/** Ligne de progression permanente : barre, « 3 / 7 », état d'enregistrement, puis points d'étape. */
export function InspectionProgress({ step, total, saveState }: InspectionProgressProps) {
  const shown = Math.min(step, total - 1) + 1
  return (
    <Box px="md" pt={10} pb={8} style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Group gap={10} wrap="nowrap">
        <Progress value={(shown / total) * 100} color="cyan" size="sm" radius="xl" style={{ flex: 1 }} aria-label="Progression du contrôle" />
        <Text fz={13} fw={700} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {shown} / {total}
        </Text>
        <SaveStatus state={saveState} />
      </Group>
      <Group gap={6} justify="center" mt={8} aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <Box
            key={index}
            w={index === step ? 18 : 8}
            h={8}
            bg={index < step ? 'cyan.4' : index === step ? 'cyan.8' : 'gray.3'}
            style={{ borderRadius: 4 }}
          />
        ))}
      </Group>
    </Box>
  )
}
