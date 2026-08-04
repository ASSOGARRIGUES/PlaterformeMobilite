import { useState } from 'react'
import { ActionIcon, Badge, Box, Button, Collapse, Group, Image, Loader, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconBulb, IconChevronDown, IconPlus, IconTool } from '@tabler/icons-react'
import { components } from '../../../types/schema'
import { LocalTask } from '../../../types/garage'
import { TaskCard } from '../TaskCard'
import { TaskPicker } from '../TaskPicker'
import { PhotoLightbox } from '../PhotoLightbox'
import { computePartsSubtotal } from '../taskCardUtils'

type Vehicle = components['schemas']['Vehicle']

type StepTasksDoneProps = {
  vehicle: Vehicle
  tasks: LocalTask[]
  suggestions: LocalTask[]
  onAddTask: (task: LocalTask) => Promise<void>
  onUpdateTask: (task: LocalTask) => void
  onCommitTask?: (task: LocalTask) => void
  onRemoveTask: (localId: string) => void
  isMutating: boolean
}

/** Ligne de suggestion, dépliable pour voir la description/les photos de la tâche telle que réalisée à la fiche précédente. */
function SuggestionRow({ suggestion, onAdd, disabled }: { suggestion: LocalTask; onAdd: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const hasDetails = !!suggestion.description || suggestion.photos.length > 0 || suggestion.parts.length > 0

  return (
    <Box style={{ borderLeft: '2px solid var(--mantine-color-cyan-4)', paddingLeft: 10 }}>
      <Group justify="space-between" wrap="nowrap" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <UnstyledButton
          onClick={() => hasDetails && setOpen((o) => !o)}
          style={{ flex: 1, cursor: hasDetails ? 'pointer' : 'default' }}
        >
          <Group gap="xs" wrap="nowrap">
            <Text size="sm">{suggestion.name}</Text>
            {suggestion.periodicityLabel && (
              <Badge variant="light" color="cyan" size="sm">
                {suggestion.periodicityLabel}
              </Badge>
            )}
            {hasDetails && (
              <IconChevronDown
                size={14}
                style={{ transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : undefined }}
              />
            )}
          </Group>
        </UnstyledButton>
        <ActionIcon
          variant="subtle"
          color="cyan"
          radius="md"
          aria-label="Ajouter la tâche suggérée"
          onClick={onAdd}
          disabled={disabled}
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      {hasDetails && (
        <Collapse in={open}>
          <Stack gap={6} pb={8}>
            {suggestion.description && (
              <Text size="sm" c="dimmed">
                {suggestion.description}
              </Text>
            )}
            {suggestion.parts.length > 0 && (
              <Stack gap={2}>
                {suggestion.parts.map((part) => (
                  <Group key={part.localId} justify="space-between" wrap="nowrap">
                    <Text size="sm">
                      {part.name} {part.quantity > 1 ? `× ${part.quantity}` : ''}
                    </Text>
                    <Text size="sm" ff="monospace">
                      {(part.unitPrice * part.quantity).toFixed(2)} €
                    </Text>
                  </Group>
                ))}
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={600}>
                    Sous-total
                  </Text>
                  <Text size="sm" fw={600} ff="monospace">
                    {computePartsSubtotal(suggestion.parts).toFixed(2)} €
                  </Text>
                </Group>
              </Stack>
            )}
            {suggestion.photos.length > 0 && (
              <Group gap="xs">
                {suggestion.photos.map((photo, index) => (
                  <Image
                    key={index}
                    src={photo}
                    w={60}
                    h={60}
                    radius={4}
                    fit="cover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setPreviewIndex(index)}
                  />
                ))}
              </Group>
            )}
          </Stack>
        </Collapse>
      )}

      {previewIndex !== null && (
        <PhotoLightbox
          photos={suggestion.photos}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </Box>
  )
}

export function StepTasksDone({
  vehicle,
  tasks,
  suggestions,
  onAddTask,
  onUpdateTask,
  onCommitTask,
  onRemoveTask,
  isMutating,
}: StepTasksDoneProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(true)

  const existingCatalogTaskIds = tasks
    .map((task) => task.catalogTaskId)
    .filter((id): id is number => id !== undefined)

  return (
    <Stack gap="md">
      {suggestions.length > 0 && (
        <Box>
          <UnstyledButton
            onClick={() => setSuggestionsOpen((open) => !open)}
            aria-expanded={suggestionsOpen}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 2px',
              borderBottom: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <IconBulb size={16} color="var(--mantine-color-cyan-7)" />
            <Text fw={700} size="sm">
              Suggestions
            </Text>
            <Text c="dimmed" fw={600} size="sm">
              ({suggestions.length})
            </Text>
            <IconChevronDown
              size={16}
              style={{
                marginLeft: 'auto',
                transition: 'transform 150ms ease',
                transform: suggestionsOpen ? 'rotate(180deg)' : undefined,
              }}
            />
          </UnstyledButton>
          <Collapse in={suggestionsOpen}>
            <Stack gap={6} pt={4} pb={4}>
              {suggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.localId}
                  suggestion={suggestion}
                  disabled={isMutating}
                  onAdd={() =>
                    void onAddTask({ ...suggestion, localId: crypto.randomUUID(), serverId: undefined, type: 'done' })
                  }
                />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      <Group
        gap={8}
        style={{ padding: '10px 2px', borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <IconTool size={16} color="var(--mantine-color-cyan-7)" />
        <Text fw={700} size="sm">
          Tâches réalisées
        </Text>
        <Text c="dimmed" fw={600} size="sm">
          ({tasks.length})
        </Text>
      </Group>

      {tasks.length === 0 && (
        <Text c="dimmed" size="sm">
          Aucune tâche réalisée pour le moment.
        </Text>
      )}
      {tasks.map((task) => (
        <TaskCard
          key={task.localId}
          task={task}
          onChange={(updated) => onUpdateTask(updated)}
          onCommit={onCommitTask}
          onRemove={() => onRemoveTask(task.localId)}
        />
      ))}
      {isMutating && (
        <Group justify="center" py="xs">
          <Loader size="sm" />
        </Group>
      )}
      <Button
        variant="light"
        leftSection={<IconPlus size={18} stroke={2} />}
        onClick={() => setPickerOpen(true)}
        disabled={isMutating}
        style={{ minHeight: 48 }}
      >
        Ajouter une tâche
      </Button>

      <TaskPicker
        vehicleType={vehicle.type!}
        opened={pickerOpen}
        existingCatalogTaskIds={existingCatalogTaskIds}
        onClose={() => setPickerOpen(false)}
        onPick={(task) => {
          if (isMutating) return
          setPickerOpen(false)
          void onAddTask(task)
        }}
      />
    </Stack>
  )
}
