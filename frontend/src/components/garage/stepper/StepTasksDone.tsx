import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconBulb, IconChevronDown, IconPlus, IconTool } from '@tabler/icons-react'
import { components } from '../../../types/schema'
import { LocalTask, MaintenanceSignalement, MaintenanceSummary, MaintenanceTask } from '../../../types/garage'
import { TaskCard } from '../TaskCard'
import { TaskPicker } from '../TaskPicker'
import { PhotoLightbox } from '../PhotoLightbox'
import { TaskCatalogItem } from '../taskCardUtils'
import { MaintenanceSignalementRow, MaintenanceTaskRow } from '../maintenance/MaintenanceTaskRow'
import { MAINTENANCE_SECTION_COLORS, signalementAuthor } from '../maintenance/maintenanceUtils'
import { WIDE_TASK_GRID_QUERY } from '../../../hooks/garage/breakpoints'
import { PendingSuggestions, localTaskFromSuggestion } from '../../../hooks/garage/interventionStepperUtils'

type Vehicle = components['schemas']['Vehicle']

export type SuggestionBlock = {
  suggestions: PendingSuggestions
  maintenanceSummary: MaintenanceSummary
  catalogById: Map<number, TaskCatalogItem>
}

type StepTasksDoneProps = {
  vehicle: Vehicle
  tasks: LocalTask[]
  /** Absent en édition d'une fiche validée : pas de bloc Suggestions */
  suggestionBlock?: SuggestionBlock
  /** Synthèse en chargement ou en échec (403 compris) : le bloc le dit au lieu de disparaître en silence. Sans effet en édition. */
  suggestionsState?: 'loading' | 'error'
  onAddTask: (task: LocalTask) => Promise<void>
  onUpdateTask: (task: LocalTask) => void
  onCommitTask?: (task: LocalTask) => void
  onRemoveTask: (localId: string) => void
  isMutating: boolean
}

export function StepTasksDone({
  vehicle,
  tasks,
  suggestionBlock,
  suggestionsState,
  onAddTask,
  onUpdateTask,
  onCommitTask,
  onRemoveTask,
  isMutating,
}: StepTasksDoneProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(true)
  const isWideGrid = useMediaQuery(WIDE_TASK_GRID_QUERY, false)
  // Application installée : un nouvel onglet en sortirait, le lien « Fiche #n » est alors masqué
  const isStandalone = useMediaQuery('(display-mode: standalone)', false)
  const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  // Ouvre automatiquement la carte de la dernière tâche ajoutée, pour inciter à remplir les détails.
  // Les nouvelles tâches sont ajoutées en tête de liste (cf. useInterventionStepper/useValidatedInterventionEdit),
  // donc "premier élément du tableau après un ajout" suffit à identifier la nouvelle tâche, sans suivre son id.
  const [hasAdded, setHasAdded] = useState(false)
  const addTask = (task: LocalTask) => {
    setHasAdded(true)
    void onAddTask(task)
  }

  // Grille 2 colonnes (≥1500px) : les deux tâches d'une même ligne s'ouvrent/se ferment ensemble
  // (sinon la carte encore fermée s'étire vide pour matcher la hauteur de sa voisine ouverte).
  const isPairedGrid = isWideGrid
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const toggleRow = (row: number) =>
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return next
    })
  const previousTaskCount = useRef(tasks.length)
  useEffect(() => {
    if (tasks.length > previousTaskCount.current) {
      // Nouvelle tâche toujours en tête (index 0) → toujours la ligne 0
      setExpandedRows((prev) => new Set(prev).add(0))
    }
    previousTaskCount.current = tasks.length
  }, [tasks.length])

  const existingCatalogTaskIds = tasks
    .map((task) => task.catalogTaskId)
    .filter((id): id is number => id !== undefined)

  const pickerButton = (
    <Button
      variant="light"
      size="xs"
      leftSection={<IconPlus size={14} stroke={2} />}
      onClick={() => setPickerOpen(true)}
      disabled={isMutating}
    >
      Ajouter une tâche
    </Button>
  )

  const suggestionsCount = suggestionBlock
    ? suggestionBlock.suggestions.overdue.length + suggestionBlock.suggestions.toPlan.length + suggestionBlock.suggestions.signalements.length
    : 0
  const addButton = (source: MaintenanceTask | MaintenanceSignalement, catalogById: Map<number, TaskCatalogItem>) => (
    <ActionIcon
      variant="outline"
      color="cyan"
      size={32}
      radius="md"
      aria-label="Ajouter la tâche suggérée"
      disabled={isMutating}
      onClick={() => addTask(localTaskFromSuggestion(source, catalogById))}
    >
      <IconPlus size={18} />
    </ActionIcon>
  )

  const renderSuggestions = ({ suggestions: { overdue, toPlan, signalements }, maintenanceSummary, catalogById }: SuggestionBlock) => {
    const rowProps = {
      collapsible: true as const,
      today: maintenanceSummary.today,
      showDate: false,
      authorOf: (signalement: MaintenanceSignalement) => signalementAuthor(maintenanceSummary, signalement),
      // Nouvel onglet : les saisies de l'étape courante ne sont enregistrées qu'au changement d'étape
      onOpenSheet: isStandalone ? undefined : (sheetId: number) => window.open(`/garage/intervention/${sheetId}`, '_blank', 'noopener,noreferrer'),
      onOpenPhotos: (photos: string[]) => {
        setLightboxIndex(0)
        setLightboxPhotos(photos)
      },
    }
    return (
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
            ({suggestionsCount})
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
          <Stack gap={6} pt="xs" pb={4}>
            {overdue.map((task) => (
              <MaintenanceTaskRow key={task.catalog_task_id} task={task} color={MAINTENANCE_SECTION_COLORS.overdue} {...rowProps} action={addButton(task, catalogById)} />
            ))}
            {toPlan.map((task) => (
              <MaintenanceTaskRow key={task.catalog_task_id} task={task} color={MAINTENANCE_SECTION_COLORS.toPlan} {...rowProps} action={addButton(task, catalogById)} />
            ))}
            {signalements.map((signalement) => (
              <MaintenanceSignalementRow
                key={signalement.task_id}
                signalement={signalement}
                author={rowProps.authorOf(signalement)}
                today={rowProps.today}
                onOpenSheet={rowProps.onOpenSheet}
                onOpenPhotos={rowProps.onOpenPhotos}
                collapsible
                action={addButton(signalement, catalogById)}
              />
            ))}
          </Stack>
        </Collapse>
      </Box>
    )
  }

  return (
    <Stack gap="md">
      {lightboxPhotos && (
        <PhotoLightbox photos={lightboxPhotos} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxPhotos(null)} />
      )}
      {suggestionBlock && suggestionsCount > 0 && renderSuggestions(suggestionBlock)}
      {!suggestionBlock && suggestionsState && (
        <Text c="dimmed" size="sm" role="status">
          {suggestionsState === 'loading' ? 'Chargement des suggestions…' : 'Suggestions indisponibles'}
        </Text>
      )}

      <Group
        justify="space-between"
        style={{
          padding: '10px 2px',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--mantine-color-body)',
        }}
      >
        <Group gap={8}>
          <IconTool size={16} color="var(--mantine-color-cyan-7)" />
          <Text fw={700} size="sm">
            Tâches réalisées
          </Text>
          <Text c="dimmed" fw={600} size="sm">
            ({tasks.length})
          </Text>
        </Group>
        {pickerButton}
      </Group>

      {tasks.length === 0 && (
        <Text c="dimmed" size="sm">
          Aucune tâche réalisée pour le moment.
        </Text>
      )}
      <SimpleGrid cols={isWideGrid ? 2 : 1} spacing="md">
        {tasks.map((task, index) =>
          isPairedGrid ? (
            <TaskCard
              key={task.localId}
              task={task}
              onChange={(updated) => onUpdateTask(updated)}
              onCommit={onCommitTask}
              onRemove={() => onRemoveTask(task.localId)}
              expanded={expandedRows.has(Math.floor(index / 2))}
              onToggleExpanded={() => toggleRow(Math.floor(index / 2))}
            />
          ) : (
            <TaskCard
              key={task.localId}
              task={task}
              onChange={(updated) => onUpdateTask(updated)}
              onCommit={onCommitTask}
              onRemove={() => onRemoveTask(task.localId)}
              defaultExpanded={hasAdded && index === 0}
            />
          ),
        )}
      </SimpleGrid>
      {isMutating && (
        <Group justify="center" py="xs">
          <Loader size="sm" />
        </Group>
      )}

      <TaskPicker
        vehicleType={vehicle.type!}
        opened={pickerOpen}
        existingCatalogTaskIds={existingCatalogTaskIds}
        onClose={() => setPickerOpen(false)}
        onPick={(task) => {
          if (isMutating) return
          setPickerOpen(false)
          addTask(task)
        }}
      />
    </Stack>
  )
}
