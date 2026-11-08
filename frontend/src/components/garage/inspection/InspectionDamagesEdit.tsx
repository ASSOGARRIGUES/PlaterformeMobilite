import { ActionIcon, Box, FileButton, Group, Image, Paper, Stack, Text, Textarea, Button } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { IconAlertTriangle, IconCameraFilled, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { LocalDamage } from '../../../types/garage'
import { readAsBase64 } from '../taskCardUtils'
import { useSaveEngine } from '../../../hooks/garage/useSaveEngine'
import { EditField } from './InspectionEditParts'

type Props = {
  engine: ReturnType<typeof useSaveEngine>
  items: LocalDamage[]
  onAdd: () => void
  onType: (localId: string, description: string) => void
  onCommitDescription: (localId: string) => void
  onAddPhoto: (localId: string, dataUrl: string) => void
  onRemovePhoto: (localId: string, index: number) => void
  onRemove: (localId: string) => void
}

/** Dégâts d'une fiche validée : chaque champ s'enregistre aussitôt ; un nouveau dégât part avec sa première description. */
export function InspectionDamagesEdit({ engine, items, onAdd, onType, onCommitDescription, onAddPhoto, onRemovePhoto, onRemove }: Props) {
  const addPhoto = async (localId: string, file: File | null) => {
    if (!file) return
    try {
      onAddPhoto(localId, await readAsBase64(file))
    } catch (error) {
      console.error('Erreur de lecture de la photo', error)
      showNotification({ color: 'red', message: "La photo n'a pas pu être lue." })
    }
  }
  return (
    <Stack gap="sm">
      {items.map((damage, index) => (
        <Paper key={damage.localId} withBorder radius="md" p="sm">
          <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <IconAlertTriangle size={19} color="var(--mantine-color-orange-7)" aria-hidden />
                <Text fw={700}>Dégât {index + 1}</Text>
              </Group>
              <ActionIcon variant="subtle" color="red" size={48} aria-label={`Supprimer le dégât ${index + 1}`} onClick={() => onRemove(damage.localId)}>
                <IconTrash size={20} />
              </ActionIcon>
            </Group>
            <EditField engine={engine} groups={[`damage.${damage.localId}.photos`]}>
              <Group gap="xs">
                {damage.photos.map((photo, photoIndex) => (
                  <Box key={photoIndex} pos="relative">
                    <Image src={photo} w={80} h={80} radius={4} fit="cover" alt={`Photo du dégât ${index + 1}`} />
                    <ActionIcon
                      size={28}
                      color="red"
                      variant="filled"
                      radius="xl"
                      pos="absolute"
                      top={2}
                      right={2}
                      aria-label={`Retirer la photo ${photoIndex + 1} du dégât ${index + 1}`}
                      onClick={() => onRemovePhoto(damage.localId, photoIndex)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Box>
                ))}
                <FileButton onChange={(file) => addPhoto(damage.localId, file)} accept="image/*" capture="environment">
                  {(props) => (
                    <ActionIcon {...props} size={80} variant="light" radius={4} aria-label={`Ajouter une photo au dégât ${index + 1}`}>
                      <IconCameraFilled size={28} />
                    </ActionIcon>
                  )}
                </FileButton>
              </Group>
            </EditField>
            <EditField engine={engine} groups={[`damage.${damage.localId}.description`]} label="Description">
              <Textarea
                placeholder="Où ? Quoi ?"
                aria-label={`Description du dégât ${index + 1}`}
                description={damage.serverId ? undefined : 'Le dégât est enregistré dès que sa description est renseignée.'}
                value={damage.description}
                onChange={(event) => onType(damage.localId, event.currentTarget.value)}
                onBlur={() => onCommitDescription(damage.localId)}
                minRows={2}
                autosize
              />
            </EditField>
          </Stack>
        </Paper>
      ))}
      <Button variant="light" mih={52} leftSection={<IconPlus size={18} />} onClick={onAdd}>Ajouter un dégât</Button>
    </Stack>
  )
}
