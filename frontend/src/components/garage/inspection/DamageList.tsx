import { useRef } from 'react'
import { showNotification } from '@mantine/notifications'
import { ActionIcon, Box, Button, FileButton, Group, Image, Paper, Stack, Text, Textarea } from '@mantine/core'
import { IconAlertTriangle, IconCameraFilled, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { LocalDamage } from '../../../types/garage'
import { newLocalId, readAsBase64 } from '../taskCardUtils'

type DamageListProps = {
  items: LocalDamage[]
  onChange: (items: LocalDamage[]) => void
  /** Index (0-based) du dégât dont la description est refusée, pour l'afficher en rouge. */
  invalidIndex?: number | null
}

/** Une carte par dégât : description + photos 80 × 80, suppression 48 px ; « Ajouter un dégât » en bas. */
export function DamageList({ items, onChange, invalidIndex = null }: DamageListProps) {
  // Dernière liste connue : la lecture d'une photo est asynchrone, une saisie a pu avoir lieu entre-temps.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const update = (localId: string, patch: Partial<LocalDamage>) =>
    onChange(itemsRef.current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))

  const addPhoto = async (damage: LocalDamage, file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await readAsBase64(file)
      const latest = itemsRef.current.find((item) => item.localId === damage.localId)
      if (!latest) return
      update(damage.localId, { photos: [...latest.photos, dataUrl], photoIds: [...(latest.photoIds ?? latest.photos.map(() => null)), null] })
    } catch (error) {
      console.error('Erreur de lecture de la photo', error)
      showNotification({ color: 'red', message: "La photo n'a pas pu être lue." })
    }
  }

  const removePhoto = (damage: LocalDamage, index: number) =>
    update(damage.localId, {
      photos: damage.photos.filter((_, i) => i !== index),
      photoIds: (damage.photoIds ?? damage.photos.map(() => null)).filter((_, i) => i !== index),
    })

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
              <ActionIcon
                variant="subtle"
                color="red"
                size={48}
                aria-label={`Supprimer le dégât ${index + 1}`}
                onClick={() => onChange(items.filter((item) => item.localId !== damage.localId))}
              >
                <IconTrash size={20} />
              </ActionIcon>
            </Group>
            <Group gap="xs">
              {damage.photos.map((photo, photoIndex) => (
                <Box key={photoIndex} pos="relative">
                  <Image src={photo} w={80} h={80} radius={4} fit="cover" alt={`Photo du dégât ${index + 1}`} />
                  <ActionIcon
                    size={32}
                    color="red"
                    variant="filled"
                    radius="xl"
                    pos="absolute"
                    top={-10}
                    right={-10}
                    onClick={() => removePhoto(damage, photoIndex)}
                    aria-label="Supprimer la photo"
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Box>
              ))}
              <FileButton onChange={(file) => addPhoto(damage, file)} accept="image/*" capture="environment">
                {(props) => (
                  <ActionIcon {...props} size={80} variant="light" radius={4} aria-label="Ajouter une photo">
                    <IconCameraFilled size={28} />
                  </ActionIcon>
                )}
              </FileButton>
            </Group>
            <Textarea
              placeholder="Où ? Quoi ?"
              aria-label={`Description du dégât ${index + 1}`}
              value={damage.description}
              error={invalidIndex === index ? 'Description manquante' : undefined}
              onChange={(event) => update(damage.localId, { description: event.currentTarget.value })}
              minRows={2}
              autosize
            />
          </Stack>
        </Paper>
      ))}
      <Button
        variant="light"
        mih={52}
        leftSection={<IconPlus size={18} />}
        onClick={() => onChange([...items, { localId: newLocalId(), description: '', photos: [], photoIds: [] }])}
      >
        Ajouter un dégât
      </Button>
    </Stack>
  )
}
