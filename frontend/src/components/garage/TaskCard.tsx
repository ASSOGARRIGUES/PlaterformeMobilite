import { useState } from 'react'
import {
  Paper,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Collapse,
  Slider,
  TextInput,
  NumberInput,
  Textarea,
  Button,
  FileButton,
  Image,
  Box,
  UnstyledButton,
  Input,
} from '@mantine/core'
import { IconTool, IconTrash, IconChevronDown, IconChevronUp, IconX, IconCameraFilled, IconPlus } from '@tabler/icons-react'
import { LocalTask, LocalTaskPart } from '../../types/garage'
import { computePartsSubtotal, isWearLevelCritical } from './taskCardUtils'
import { PhotoLightbox } from './PhotoLightbox'

type TaskCardProps = {
  task: LocalTask
  onChange: (task: LocalTask) => void
  onCommit?: (task: LocalTask) => void
  onRemove: () => void
  readOnly?: boolean
  /** Ouvre la carte dès le montage (tâche qui vient d'être ajoutée) pour inciter à remplir les détails */
  defaultExpanded?: boolean
  /** Mode contrôlé (grille desktop 2 colonnes) : synchronise l'ouverture avec `onToggleExpanded` au lieu de l'état interne */
  expanded?: boolean
  onToggleExpanded?: () => void
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function TaskCard({
  task,
  onChange,
  onCommit,
  onRemove,
  readOnly = false,
  defaultExpanded = false,
  expanded: expandedProp,
  onToggleExpanded,
}: TaskCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const expanded = expandedProp ?? internalExpanded
  const toggleExpanded = onToggleExpanded ?? (() => setInternalExpanded((e) => !e))
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const commit = (updated: LocalTask) => {
    onChange(updated)
    onCommit?.(updated)
  }

  const updateParts = (parts: LocalTaskPart[]) => onChange({ ...task, parts })

  const addPart = () => {
    commit({ ...task, parts: [...task.parts, { localId: crypto.randomUUID(), name: '', unitPrice: 0, quantity: 1 }] })
  }

  const updatePart = (localId: string, patch: Partial<LocalTaskPart>) => {
    updateParts(task.parts.map((part) => (part.localId === localId ? { ...part, ...patch } : part)))
  }

  const removePart = (localId: string) => {
    commit({ ...task, parts: task.parts.filter((part) => part.localId !== localId) })
  }

  const addPhoto = async (file: File | null) => {
    if (!file) return
    try {
      const dataUrl = await readAsBase64(file)
      commit({ ...task, photos: [...task.photos, dataUrl] })
    } catch (error) {
      console.error('Erreur de lecture de la photo', error)
    }
  }

  const removePhoto = (index: number) => {
    commit({ ...task, photos: task.photos.filter((_, i) => i !== index) })
  }

  return (
    <Paper shadow="sm" radius={4} p="md" withBorder>
      <UnstyledButton onClick={toggleExpanded} style={{ width: '100%' }}>
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <IconTool size={20} stroke={2} style={{ flexShrink: 0 }} />
              <Text fw={500} truncate="end">
                {task.name}
              </Text>
            </Group>
            {task.periodicityLabel && (
              <Badge variant="light" color="cyan" style={{ alignSelf: 'flex-start', marginLeft: 28 }}>
                {task.periodicityLabel}
              </Badge>
            )}
          </Stack>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {!readOnly && (
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                aria-label="Supprimer la tâche"
              >
                <IconTrash size={18} stroke={2} />
              </ActionIcon>
            )}
            {expanded ? <IconChevronUp size={18} stroke={2} /> : <IconChevronDown size={18} stroke={2} />}
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse in={expanded}>
        <Stack gap="md" mt="md">
          {task.isWearTask && task.type === 'done' && (
            <Stack gap={4}>
              <Text size="sm">
                État de la pièce posée :{' '}
                <Text
                  span
                  fw={600}
                  c={isWearLevelCritical(task.wearLevel ?? 10) ? 'red' : undefined}
                >
                  {task.wearLevel ?? 10}/10
                </Text>
              </Text>
              {!readOnly && (
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={task.wearLevel ?? 10}
                  onChange={(value) => onChange({ ...task, wearLevel: value })}
                  onChangeEnd={(value) => onCommit?.({ ...task, wearLevel: value })}
                  marks={Array.from({ length: 11 }, (_, i) => ({ value: i }))}
                  color={isWearLevelCritical(task.wearLevel ?? 10) ? 'red' : (task.wearLevel ?? 10) <= 6 ? 'orange' : 'teal'}
                />
              )}
            </Stack>
          )}

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Pièces
            </Text>
            {readOnly && task.parts.length === 0 && (
              <Text size="sm" c="dimmed">Aucune pièce</Text>
            )}
            {readOnly
              ? task.parts.map((part) => (
                  <Group key={part.localId} justify="space-between" wrap="nowrap">
                    <Text size="sm">{part.name || '—'}</Text>
                    <Text size="sm" ff="monospace" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {part.quantity} × {part.unitPrice.toFixed(2)} €
                    </Text>
                  </Group>
                ))
              : task.parts.map((part) => (
                  <Group key={part.localId} wrap="nowrap" align="flex-end">
                    <TextInput
                      label="Désignation"
                      value={part.name}
                      onChange={(e) => updatePart(part.localId, { name: e.currentTarget.value })}
                      onBlur={() => onCommit?.(task)}
                      style={{ flex: 2 }}
                    />
                    <NumberInput
                      label="P.U."
                      min={0}
                      decimalScale={2}
                      value={part.unitPrice}
                      onChange={(value) => updatePart(part.localId, { unitPrice: Math.max(0, Number(value) || 0) })}
                      onBlur={() => onCommit?.(task)}
                      style={{ flex: 1 }}
                    />
                    <NumberInput
                      label="Qté"
                      min={1}
                      value={part.quantity}
                      onChange={(value) => updatePart(part.localId, { quantity: Math.max(1, Number(value) || 1) })}
                      onBlur={() => onCommit?.(task)}
                      style={{ flex: 1 }}
                    />
                    <Input.Wrapper label=" ">
                      <ActionIcon
                        size="lg"
                        color="red"
                        variant="subtle"
                        onClick={() => removePart(part.localId)}
                        aria-label="Supprimer la pièce"
                      >
                        <IconX size={18} stroke={2} />
                      </ActionIcon>
                    </Input.Wrapper>
                  </Group>
                ))}
            {!readOnly && (
              <Button variant="light" leftSection={<IconPlus size={16} stroke={2} />} onClick={addPart}>
                Ajouter une pièce
              </Button>
            )}
          </Stack>

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Description
            </Text>
            {readOnly ? (
              <Text size="sm" c={task.description ? undefined : 'dimmed'}>
                {task.description || 'Aucune description renseignée'}
              </Text>
            ) : (
              <Textarea
                placeholder="Détails complémentaires (optionnel)"
                value={task.description ?? ''}
                onChange={(e) => onChange({ ...task, description: e.currentTarget.value })}
                onBlur={() => onCommit?.(task)}
              />
            )}
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Photos
            </Text>
            {readOnly && task.photos.length === 0 && (
              <Text size="sm" c="dimmed">
                Aucune photo
              </Text>
            )}
            <Group gap="xs">
              {task.photos.map((photo, index) => (
                <Box key={index} pos="relative">
                  <Image
                    src={photo}
                    w={80}
                    h={80}
                    radius={4}
                    fit="cover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setPreviewIndex(index)}
                  />
                  {!readOnly && (
                    <ActionIcon
                      size="xs"
                      color="red"
                      variant="filled"
                      radius="xl"
                      pos="absolute"
                      top={-6}
                      right={-6}
                      onClick={() => removePhoto(index)}
                      aria-label="Supprimer la photo"
                    >
                      <IconX size={12} stroke={2} />
                    </ActionIcon>
                  )}
                </Box>
              ))}
              {!readOnly && (
                <FileButton onChange={addPhoto} accept="image/*" capture="environment">
                  {(props) => (
                    <ActionIcon {...props} size={80} variant="light" radius={4} aria-label="Ajouter une photo">
                      <IconCameraFilled size={28} stroke={2} />
                    </ActionIcon>
                  )}
                </FileButton>
              )}
            </Group>
          </Stack>

          <Group justify="flex-end">
            <Text ff="monospace" size="sm">
              Sous-total : {computePartsSubtotal(task.parts).toFixed(2)} €
            </Text>
          </Group>
        </Stack>
      </Collapse>

      {previewIndex !== null && (
        <PhotoLightbox
          photos={task.photos}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </Paper>
  )
}
