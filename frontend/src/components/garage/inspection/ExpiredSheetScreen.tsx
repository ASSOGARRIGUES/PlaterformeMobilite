import { Box, Button, Stack, Text, Title } from '@mantine/core'
import { IconClockOff, IconPlus } from '@tabler/icons-react'

type ExpiredSheetScreenProps = {
  imat: string
  openedAt: string
  onNew: () => void
}

/** Remplace le stepper quand la fiche est restée ouverte plus longtemps que la durée de reprise. */
export function ExpiredSheetScreen({ imat, openedAt, onNew }: ExpiredSheetScreenProps) {
  return (
    <Stack align="center" justify="center" gap={14} px="lg" mih="60vh" ta="center">
      <Box
        w={84}
        h={84}
        bg="gray.1"
        c="dimmed"
        style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <IconClockOff size={46} aria-hidden />
      </Box>
      <Title order={2}>Fiche expirée</Title>
      <Text maw={290}>Cette fiche est restée ouverte plus de 24 h et ne peut plus être reprise.</Text>
      <Text size="sm" c="dimmed">
        <Text component="span" ff="monospace" fw={700} c="var(--mantine-color-text)" className="sentry-mask">{imat}</Text>
        {` · ouverte ${openedAt}`}
      </Text>
      <Button color="cyan" size="md" mih={48} w="100%" maw={300} leftSection={<IconPlus size={18} />} onClick={onNew}>
        Nouveau contrôle
      </Button>
    </Stack>
  )
}
