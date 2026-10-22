import { ReactNode, useMemo, useState } from 'react'
import { useGo } from '@refinedev/core'
import {
  Accordion,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChevronRight,
  IconCircleCheck,
  IconFileDescription,
  IconHistoryOff,
  IconListDetails,
  IconSearch,
  IconTool,
} from '@tabler/icons-react'
import { MaintenanceSheet, MaintenanceSignalement, MaintenanceSummary } from '../../../types/garage'
import { InterventionSheetStatusEnum, MaintenanceSheetKindEnum } from '../../../types/schema.d'
import { humanizeDate, humanizeNumber, plural } from '../../../constants'
import useAccessControl from '../../../hooks/useAccessControl'
import { useDismissSignalement } from '../../../hooks/garage/useDismissSignalement'
import { PhotoLightbox } from '../PhotoLightbox'
import { MaintenanceSection } from './MaintenanceSection'
import { MaintenanceOtherWorkRow, MaintenanceSignalementRow, MaintenanceTaskRow, MaintenanceUnknownRow } from './MaintenanceTaskRow'
import {
  MAINTENANCE_SECTION_COLORS,
  MAINTENANCE_SECTION_HEADER_OFFSET,
  filterOtherWork,
  groupMaintenanceTasks,
  mainFigure,
  nextDueTask,
  referentSummary,
  signalementAuthor,
  showNothingToPlan,
  sortedSignalements,
} from './maintenanceUtils'

type MaintenanceTabProps = {
  summary: MaintenanceSummary | undefined
  isLoading: boolean
  isError: boolean
}

const MOBILE_SHEETS_PREVIEW = 3

/** Accordion replié par défaut, en carte (Autres travaux, Fiches, À jour côté référent mobile). */
function FoldedSection({ value, icon, title, count, children }: { value: string; icon: ReactNode; title: string; count: number; children: ReactNode }) {
  return (
    <Accordion variant="contained" radius="md" chevronPosition="right" bg="white">
      <Accordion.Item value={value}>
        <Accordion.Control icon={icon} style={{ minHeight: 52 }}>
          <Group gap={8}>
            <Text fw={700} size="sm">{title}</Text>
            <Text size="xs" fw={600} c="dimmed">{count}</Text>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap={4}>{children}</Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}

function SheetRow({ sheet, onOpen }: { sheet: MaintenanceSheet; onOpen: () => void }) {
  const taskCount = sheet.done_count + sheet.planned_count
  const details = [
    sheet.created_by_display,
    `${taskCount} ${plural(taskCount, 'tâche', 'tâches')}`,
    sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : null,
  ]
  return (
    <UnstyledButton onClick={onOpen} p={6} style={{ minHeight: 48 }}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={32} radius="md" variant="light" color="cyan">
          <IconFileDescription size={18} />
        </ThemeIcon>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6}>
            <Text fw={700} size="sm">
              Fiche #{sheet.id} · {sheet.start_date ? humanizeDate(sheet.start_date) : 'Date non renseignée'}
            </Text>
            {sheet.status === InterventionSheetStatusEnum.open && <Badge size="xs" color="orange">Ouverte</Badge>}
          </Group>
          <Text size="xs" c="dimmed">{details.filter(Boolean).join(' · ')}</Text>
        </Stack>
        <IconChevronRight size={17} color="var(--mantine-color-gray-5)" />
      </Group>
    </UnstyledButton>
  )
}

/** Onglet Entretien (story 2.11, maquette Claude Design « Onglet Entretien ») : lecture seule de la synthèse chargée par VehicleShow. */
export function MaintenanceTab({ summary, isLoading, isError }: MaintenanceTabProps) {
  const go = useGo()
  const theme = useMantineTheme()
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, false)
  const { isAuthorized } = useAccessControl()
  const canManage = !!isAuthorized('garage.manage_intervention')
  const { confirmDismiss } = useDismissSignalement(summary?.vehicle_id ?? 0)
  const [otherWorkQuery, setOtherWorkQuery] = useState('')
  const [allSheetsShown, setAllSheetsShown] = useState(false)
  const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const groups = useMemo(() => (summary ? groupMaintenanceTasks(summary) : null), [summary])
  const signalements = useMemo(() => (summary ? sortedSignalements(summary) : []), [summary])

  if (isError) return <Text c="dimmed">Impossible de charger l&apos;entretien du véhicule.</Text>

  if (isLoading || !summary || !groups) {
    return (
      <Stack gap="xs">
        <Skeleton height={8} radius="xl" />
        <Skeleton height={8} radius="xl" />
        <Skeleton height={8} width="70%" radius="xl" />
      </Stack>
    )
  }

  const { today } = summary
  const showDate = !isMobile
  const openSheetById = (sheetId: number, kind: MaintenanceSheetKindEnum = MaintenanceSheetKindEnum.intervention) =>
    go({ to: kind === MaintenanceSheetKindEnum.inspection ? `/vehicle/${summary.vehicle_id}/inspection/${sheetId}` : `/garage/intervention/${sheetId}` })
  const openPhotos = (photos: string[]) => {
    setLightboxIndex(0)
    setLightboxPhotos(photos)
  }
  const authorOf = (signalement: MaintenanceSignalement) => signalementAuthor(summary, signalement)
  const rowProps = { today, showDate, stacked: isMobile, authorOf, onOpenSheet: openSheetById, onOpenPhotos: openPhotos, onDismiss: canManage ? confirmDismiss : undefined }

  const notRecordedSection = groups.notRecorded.length > 0 && (
    <MaintenanceSection kind="notRecorded" count={groups.notRecorded.length}>
      {groups.notRecorded.map((task) => (
        <MaintenanceUnknownRow key={task.catalog_task_id} task={task} />
      ))}
    </MaintenanceSection>
  )

  const lightbox = lightboxPhotos && (
    <PhotoLightbox photos={lightboxPhotos} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxPhotos(null)} />
  )

  // Véhicule sans aucune fiche : un message, puis les tâches suivies à renseigner (pas de sections vides)
  if (summary.sheets.length === 0) {
    return (
      <Stack gap="lg">
        <Paper withBorder radius="md" p="lg">
          <Stack gap="xs" align="center" ta="center">
            <ThemeIcon size={56} radius="lg" variant="light" color="gray">
              <IconHistoryOff size={30} />
            </ThemeIcon>
            <Title order={4}>Aucune intervention enregistrée</Title>
            <Text size="sm" c="dimmed" maw={420}>
              Les échéances s&apos;afficheront après la première intervention.
            </Text>
          </Stack>
        </Paper>
        {notRecordedSection}
      </Stack>
    )
  }

  const referent = !canManage ? referentSummary(summary) : null
  const nextDue = showNothingToPlan(summary) ? nextDueTask(summary) : null
  const hasSignalement = signalements.length > 0
    || [...groups.overdue, ...groups.toPlan].some((task) => task.signalements.length > 0)
  const toPlanCount = groups.toPlan.length + signalements.length
  const otherWork = filterOtherWork(summary.other_work, otherWorkQuery)
  const sheets = isMobile && !allSheetsShown ? summary.sheets.slice(0, MOBILE_SHEETS_PREVIEW) : summary.sheets

  const upToDateFolded = !canManage && isMobile
  const leftHasSection = (groups.upToDate.length > 0 && !upToDateFolded) || (groups.upToDate.length === 0 && groups.notRecorded.length > 0)
  const upToDateRows = groups.upToDate.map((task) => (
    <MaintenanceTaskRow key={task.catalog_task_id} task={task} color={MAINTENANCE_SECTION_COLORS.upToDate} dense {...rowProps} />
  ))

  return (
    <Stack gap="lg">
      {lightbox}

      {referent && (
        <Alert color={referent.color} radius="md" icon={<IconAlertTriangle />} title={referent.title}>
          {referent.detail}
        </Alert>
      )}

      {nextDue && (
        <Paper bg="teal.0" radius="md" p="lg">
          <Stack gap="xs" align="center" ta="center">
            <ThemeIcon size={56} radius="lg" variant="white" color="teal">
              <IconCircleCheck size={30} />
            </ThemeIcon>
            <Title order={4} c="teal.8">Rien à prévoir</Title>
            <Text size="sm" c="dimmed">Toutes les échéances suivies sont à jour. Aucun signalement en attente.</Text>
            <Paper radius="xl" px="sm" py={4}>
              <Group gap={6} wrap="nowrap">
                <IconCalendarEvent size={16} />
                <Text size="sm">
                  Prochaine : <Text span fw={700}>{nextDue.name}</Text> {mainFigure(nextDue)}
                </Text>
              </Group>
            </Paper>
          </Stack>
        </Paper>
      )}

      {groups.overdue.length > 0 && (
        <MaintenanceSection kind="overdue" count={groups.overdue.length}>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm" verticalSpacing="sm">
            {groups.overdue.map((task) => (
              <MaintenanceTaskRow key={task.catalog_task_id} task={task} color={MAINTENANCE_SECTION_COLORS.overdue} {...rowProps} />
            ))}
          </SimpleGrid>
        </MaintenanceSection>
      )}

      {toPlanCount > 0 && (
        <MaintenanceSection kind="toPlan" count={toPlanCount}>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm" verticalSpacing="sm">
            {groups.toPlan.map((task) => (
              <MaintenanceTaskRow key={task.catalog_task_id} task={task} color={MAINTENANCE_SECTION_COLORS.toPlan} {...rowProps} />
            ))}
            {signalements.map((signalement) => (
              <MaintenanceSignalementRow
                key={signalement.task_id}
                signalement={signalement}
                author={authorOf(signalement)}
                today={today}
                onOpenSheet={openSheetById}
                onOpenPhotos={openPhotos}
                onDismiss={rowProps.onDismiss}
              />
            ))}
          </SimpleGrid>
        </MaintenanceSection>
      )}

      {hasSignalement && (
        <Group gap="md">
          <Group gap={6}>
            <Box w={22} h={5} bg="orange.6" style={{ borderRadius: 3 }} />
            <Text size="xs" c="dimmed">Échéance calculée</Text>
          </Group>
          <Group gap={6}>
            <Avatar size={18} radius="xl" color="blue" styles={{ placeholder: { fontSize: 8 } }}>AB</Avatar>
            <Text size="xs" c="dimmed">Signalé par un mécanicien</Text>
          </Group>
        </Group>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" verticalSpacing="lg">
        <Stack gap="lg">
          {groups.upToDate.length > 0 && (upToDateFolded
            ? <FoldedSection value="up-to-date" icon={<IconCircleCheck size={19} />} title="À jour" count={groups.upToDate.length}>{upToDateRows}</FoldedSection>
            : <MaintenanceSection kind="upToDate" count={groups.upToDate.length}>{upToDateRows}</MaintenanceSection>)}
          {notRecordedSection}
        </Stack>
        {/* Sur desktop, aligné sur la première carte de la colonne de gauche (sous l'en-tête de groupe) */}
        <Stack gap="lg" mt={{ base: 0, md: leftHasSection ? MAINTENANCE_SECTION_HEADER_OFFSET : 0 }}>
          <FoldedSection value="other-work" icon={<IconListDetails size={19} />} title="Autres travaux réalisés" count={summary.counts.other_work}>
            {summary.other_work.length === 0 ? (
              <Text c="dimmed" size="sm">Aucun autre travail réalisé.</Text>
            ) : (
              <>
                <TextInput
                  leftSection={<IconSearch size={16} />}
                  placeholder="Rechercher une tâche…"
                  aria-label="Rechercher une tâche"
                  value={otherWorkQuery}
                  onChange={(event) => setOtherWorkQuery(event.currentTarget.value)}
                />
                {otherWork.length === 0 && <Text c="dimmed" size="sm">Aucun résultat.</Text>}
                {otherWork.map((item) => (
                  <MaintenanceOtherWorkRow key={item.key} item={item} today={today} showDate={showDate} onOpenSheet={openSheetById} />
                ))}
              </>
            )}
          </FoldedSection>
          <FoldedSection value="sheets" icon={<IconTool size={19} />} title="Fiches d'intervention" count={summary.counts.sheets}>
            {sheets.map((sheet) => (
              <SheetRow key={sheet.id} sheet={sheet} onOpen={() => openSheetById(sheet.id)} />
            ))}
            {sheets.length < summary.sheets.length && (
              <Button variant="outline" fullWidth h={44} onClick={() => setAllSheetsShown(true)}>
                Voir les {summary.sheets.length} fiches
              </Button>
            )}
          </FoldedSection>
        </Stack>
      </SimpleGrid>
    </Stack>
  )
}
