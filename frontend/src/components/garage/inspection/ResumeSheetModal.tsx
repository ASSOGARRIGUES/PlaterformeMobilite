import { useState } from 'react'
import { Box, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { IconClipboardCheck, IconPlayerPause, IconPlayerPlay, IconTrash } from '@tabler/icons-react'

type ResumeSheetModalProps = {
  opened: boolean
  imat: string
  /** « il y a 2 h » */
  since: string
  /** « Arrêtée à l'étape 4 · Éclairage » */
  stoppedAt: string
  isAbandoning?: boolean
  onContinue: () => void
  onAbandon: () => void
  onClose: () => void
}

/** « Une fiche est déjà en cours » : continuer, ou abandonner après une confirmation en second temps (irréversible). */
export function ResumeSheetModal({ opened, imat, since, stoppedAt, isAbandoning = false, onContinue, onAbandon, onClose }: ResumeSheetModalProps) {
  const [confirming, setConfirming] = useState(false)
  const close = () => {
    setConfirming(false)
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={close}
      centered
      radius="md"
      withCloseButton={false}
      closeOnEscape={!isAbandoning}
      closeOnClickOutside={!isAbandoning}
      title={
        <Group gap={12} wrap="nowrap">
          <Box
            w={44}
            h={44}
            bg={confirming ? 'red.0' : 'blue.0'}
            c={confirming ? 'red.8' : 'blue.8'}
            style={{ borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {confirming ? <IconTrash size={24} aria-hidden /> : <IconClipboardCheck size={24} aria-hidden />}
          </Box>
          <Text fw={700} fz={18}>{confirming ? 'Abandonner la fiche ?' : 'Une fiche est déjà en cours'}</Text>
        </Group>
      }
    >
      {confirming ? (
        <Stack gap="md">
          <Text>
            Les saisies de la fiche <b className="sentry-mask">{imat}</b> seront supprimées. Cette action est définitive.
          </Text>
          <Group grow>
            <Button variant="default" mih={48} onClick={() => setConfirming(false)} disabled={isAbandoning}>Annuler</Button>
            <Button color="red" mih={48} onClick={onAbandon} loading={isAbandoning}>Abandonner</Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Stack gap={8}>
            <Text>
              Continuer la fiche en cours (<span className="sentry-mask">{imat}</span>, ouverte {since}) ?
            </Text>
            <Group gap={8} c="dimmed" wrap="nowrap">
              <IconPlayerPause size={16} aria-hidden />
              <Text size="sm">{stoppedAt}</Text>
            </Group>
          </Stack>
          <Stack gap={8}>
            <Button color="cyan" mih={48} leftSection={<IconPlayerPlay size={18} />} onClick={onContinue} disabled={isAbandoning} data-autofocus>
              Continuer
            </Button>
            <Button variant="subtle" color="red" mih={48} leftSection={<IconTrash size={18} />} onClick={() => setConfirming(true)}>
              Abandonner et créer une nouvelle
            </Button>
          </Stack>
        </Stack>
      )}
    </Modal>
  )
}
