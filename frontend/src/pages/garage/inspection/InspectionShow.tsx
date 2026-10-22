import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGo, useList, useShow } from '@refinedev/core'
import { ActionIcon, Alert, Box, Button, Center, Group, Loader, Paper, SimpleGrid, Stack, Text, Textarea, Title, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconArrowLeft, IconArrowUpRight, IconCheck, IconInfoCircle, IconLock, IconPencil, IconPlus } from '@tabler/icons-react'
import { ErrorComponent } from '../../../components/ErrorComponent'
import { humanizeNumber } from '../../../constants'
import { BinaryToggle } from '../../../components/garage/inspection/BinaryToggle'
import { LevelCheckGroup, LevelKey } from '../../../components/garage/inspection/LevelCheckGroup'
import { PhotoLightbox } from '../../../components/garage/PhotoLightbox'
import { TaskCard } from '../../../components/garage/TaskCard'
import { TaskPicker } from '../../../components/garage/TaskPicker'
import { WearTaskCard } from '../../../components/garage/WearTaskCard'
import { TaskCatalogItem } from '../../../components/garage/taskCardUtils'
import { WearConfig } from '../../../components/garage/wearUtils'
import { EditBar, EditField, ErrorDock, ErrorList } from '../../../components/garage/inspection/InspectionEditParts'
import { InspectionDamagesEdit } from '../../../components/garage/inspection/InspectionDamagesEdit'
import { InspectionHighlights, SectionId } from '../../../components/garage/inspection/InspectionHighlights'
import {
  DamagesRead,
  InspectionSection,
  LightingRead,
  NoWear,
  NoWearOnSheet,
  OpenPhoto,
  OpsRead,
  RoadTestRead,
} from '../../../components/garage/inspection/InspectionReadBlocks'
import { authorName, editAccess, inspectionFindings } from '../../../components/garage/inspection/inspectionConsultUtils'
import { inspectionDate } from '../../../components/garage/inspection/InspectionRow'
import { useGarageConfig } from '../../../hooks/garage/useGarageConfig'
import { localPlannedTaskFromApi } from '../../../hooks/garage/inspectionStepperUtils'
import { useMileageCorrection } from '../../../hooks/garage/useMileageCorrection'
import { confirmRemoval, useValidatedInspectionEdit } from '../../../hooks/garage/useValidatedInspectionEdit'
import { useWearInput } from '../../../hooks/garage/useWearInput'
import useAccessControl from '../../../hooks/useAccessControl'
import { InspectionSheet, MileageEntry } from '../../../types/garage'
import dayjs from 'dayjs'
import { IconEnum } from '../../../types/schema.d'

type Origin = 'vehicle' | 'contract'

const LEVEL_LABELS: Record<LevelKey, string> = { oil: 'Huile', coolant: 'Refroidissement', washer: 'Lave-glace' }

const jump = (section: SectionId) =>
  document.querySelector(`[data-anchor="${section}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** Détail d'une fiche de contrôle validée : lecture, puis édition champ par champ pour qui en a le droit. */
const InspectionShow = ({ origin }: { origin: Origin }) => {
  const { id: originId, inspectionId } = useParams<{ id: string; inspectionId: string }>()
  const theme = useMantineTheme()
  const isMobile = !!useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, false, { getInitialValueInEffect: false })
  const go = useGo()
  const { isAuthorized } = useAccessControl()
  const { config, editDays, isLoading: configLoading, isError: configError } = useGarageConfig()

  const { queryResult } = useShow<InspectionSheet>({ resource: 'garage/inspection', id: inspectionId })
  const sheet = queryResult.data?.data
  const [editing, setEditing] = useState(false)
  const [photo, setPhoto] = useState<{ photos: string[]; index: number } | null>(null)

  if (queryResult.error?.statusCode === 404) {
    return <ErrorComponent errorMessage="La fiche de contrôle n'existe pas ou n'est pas accessible" />
  }
  if (!sheet || !config) {
    return configError || queryResult.isError ? (
      <Stack align="center" gap="md" p="lg" ta="center">
        <Text>Impossible de charger la fiche de contrôle.</Text>
        <Button mih={48} onClick={() => { void queryResult.refetch() }}>Réessayer</Button>
      </Stack>
    ) : (
      <Center h="60vh"><Loader /></Center>
    )
  }
  void configLoading

  const access = origin === 'vehicle'
    ? editAccess(sheet, editDays, {
        canManage: !!isAuthorized('garage.manage_inspection'),
        canEditValidated: !!isAuthorized('garage.edit_validated_inspection'),
      })
    : 'none'

  const back = () => go({ to: `/${origin}/${originId}`, query: { tab: 'inspections' } })
  const openPhoto: OpenPhoto = (photos, index) => setPhoto({ photos, index })

  const vehicle = sheet.vehicle
  const title = editing ? 'Modifier le contrôle' : `Contrôle du ${inspectionDate(sheet)}`
  const byline = `${authorName(sheet)}${sheet.validated_at ? ` · ${dayjs(sheet.validated_at).format('HH:mm')}` : ''}`

  const actions = editing ? null : access === 'allowed' ? (
    <Button variant="outline" color="cyan" mih={isMobile ? 48 : undefined} leftSection={<IconPencil size={18} />} disabled={queryResult.isFetching} onClick={() => setEditing(true)}>Modifier</Button>
  ) : access === 'locked' ? (
    <Group gap={6} c="dimmed" wrap="nowrap" maw={isMobile ? 150 : 260}>
      <IconLock size={16} aria-hidden style={{ flexShrink: 0 }} />
      <Text fz={12.5} lh={1.3}>Modification réservée aux responsables après {editDays} jours</Text>
    </Group>
  ) : null

  const body = editing && sheet ? (
    <EditMode sheet={sheet} config={config} isMobile={isMobile} onDone={() => setEditing(false)} onOpenPhoto={openPhoto}
      header={{ title, vehicle, byline, back, origin }} />
  ) : (
    <ReadMode sheet={sheet} config={config} isMobile={isMobile} onOpenPhoto={openPhoto}
      header={{ title, vehicle, byline, back, origin, actions }} />
  )

  return (
    <>
      {body}
      {photo && <PhotoLightbox photos={photo.photos} index={photo.index} onIndexChange={(index) => setPhoto({ ...photo, index })} onClose={() => setPhoto(null)} />}
    </>
  )
}

type HeaderProps = {
  title: string
  vehicle: InspectionSheet['vehicle']
  byline: string
  back: () => void
  origin: Origin
  actions?: React.ReactNode
  /** Mode édition : « Terminer » à la place de « Modifier ». */
  done?: React.ReactNode
}

function Header({ title, vehicle, byline, back, origin, actions, done, isMobile }: HeaderProps & { isMobile: boolean }) {
  const backLabel = origin === 'contract' ? 'Retour au contrat' : 'Retour aux contrôles'
  const right = done ?? actions
  if (isMobile) {
    return (
      <Stack gap={4} bg="white" p="xs" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap={2} wrap="nowrap">
          <ActionIcon variant="subtle" size={48} ml={-8} aria-label={backLabel} onClick={back}><IconArrowLeft size={22} /></ActionIcon>
          <Title order={2} fz={19}>{title}</Title>
        </Group>
        <Group gap={10} wrap="nowrap" align="center">
          <Stack gap={1} fz={13} c="dimmed" style={{ flex: 1, minWidth: 0 }}>
            <Text fz={13} c="dimmed">{vehicle.brand} {vehicle.modele} · <Text component="span" ff="monospace" fz={12.5} className="sentry-mask">{vehicle.imat}</Text></Text>
            <Text fz={13} c="dimmed">{byline}</Text>
          </Stack>
          {right}
        </Group>
      </Stack>
    )
  }
  return (
    <Paper shadow="sm" p="md">
      <Group gap="sm" wrap="nowrap">
        <ActionIcon variant="subtle" size={44} aria-label={backLabel} onClick={back}><IconArrowLeft size={22} /></ActionIcon>
        <Box style={{ flex: 1 }}>
          <Title order={1} fz={22}>{title}</Title>
          <Text fz={13} c="dimmed">{vehicle.brand} {vehicle.modele} · <Text component="span" ff="monospace" fz={12.5} className="sentry-mask">{vehicle.imat}</Text></Text>
        </Box>
        {right}
      </Group>
    </Paper>
  )
}

function InfoCard({ sheet }: { sheet: InspectionSheet }) {
  const v = sheet.vehicle
  const rows: [string, React.ReactNode][] = [
    ['Véhicule', <>{v.brand} {v.modele} · <Text component="span" ff="monospace" fz={12.5} className="sentry-mask">{v.imat}</Text></>],
    ['Date', `${inspectionDate(sheet)}${sheet.validated_at ? ` à ${dayjs(sheet.validated_at).format('HH:mm')}` : ''}`],
    ['Auteur', authorName(sheet)],
    ['Kilométrage', sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—'],
  ]
  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap={10}>
        {rows.map(([key, value]) => (
          <Box key={key}>
            <Text fz={12} c="dimmed">{key}</Text>
            <Text fz={13.5} fw={600}>{value}</Text>
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

/** Opérations à prévoir en lecture : nom et périodicité viennent du catalogue du type de véhicule. */
function usePlannedRead(sheet: InspectionSheet) {
  const { data } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: [{ field: 'vehicle_types', operator: 'eq', value: sheet.vehicle.type }],
    pagination: { mode: 'off' },
  })
  const catalogById = useMemo(() => new Map((data?.data ?? []).map((item) => [item.id, item])), [data])
  return useMemo(() => sheet.tasks.map((task) => localPlannedTaskFromApi(task, catalogById)), [sheet.tasks, catalogById])
}

function Layout({ isMobile, main, aside, top }: { isMobile: boolean; main: React.ReactNode; aside: React.ReactNode; top: React.ReactNode }) {
  if (isMobile) {
    return (
      <Stack gap="sm" style={{ minWidth: 0 }}>
        {top}
        <Stack gap="sm" p="xs">{main}</Stack>
      </Stack>
    )
  }
  return (
    <Stack gap="md">
      {top}
      <Box style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 290px', gap: 14, alignItems: 'start' }}>
        <Stack gap="sm">{main}</Stack>
        <Stack gap="sm" style={{ position: 'sticky', top: 8 }}>{aside}</Stack>
      </Box>
    </Stack>
  )
}

function ReadMode({ sheet, config, isMobile, onOpenPhoto, header }: {
  sheet: InspectionSheet; config: WearConfig; isMobile: boolean; onOpenPhoto: OpenPhoto; header: HeaderProps
}) {
  const findings = inspectionFindings(sheet, config)
  const planned = usePlannedRead(sheet)
  const levels = { oil: sheet.oil_ok ?? null, coolant: sheet.coolant_ok ?? null, washer: sheet.washer_ok ?? null }
  const highlights = <InspectionHighlights findings={findings} onJump={jump} />
  const main = (
    <>
      {isMobile && highlights}
      <InspectionSection id="km" title="Kilométrage">
        <Text ff="monospace" fz={22} fw={800}>{sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—'}</Text>
      </InspectionSection>
      <InspectionSection id="levels" title="Niveaux"><LevelCheckGroup values={levels} readOnly /></InspectionSection>
      <InspectionSection id="wear" title="Usure">
        {sheet.wear_measurements.length === 0 ? <NoWearOnSheet /> : (
          <SimpleGrid cols={isMobile ? 1 : 2} spacing="xs">
            {sheet.wear_measurements.map((measurement) => (
              <WearTaskCard
                key={measurement.id}
                readOnly
                task={{ id: measurement.catalog_task, name: measurement.catalog_task_name, icon: measurement.catalog_task_icon as unknown as IconEnum }}
                value={measurement.level}
                config={config}
              />
            ))}
          </SimpleGrid>
        )}
      </InspectionSection>
      <InspectionSection id="lighting" title="Éclairage"><LightingRead ok={sheet.lights_ok} notes={sheet.lights_notes} /></InspectionSection>
      <InspectionSection id="damages" title={`Dégâts${sheet.damages.length ? ` (${sheet.damages.length})` : ''}`}>
        <DamagesRead damages={sheet.damages} onOpenPhoto={onOpenPhoto} />
      </InspectionSection>
      <InspectionSection id="road" title="Essai routier"><RoadTestRead done={sheet.road_test_done} notes={sheet.road_test_notes} /></InspectionSection>
      <InspectionSection id="ops" title={`À prévoir${sheet.tasks.length ? ` (${sheet.tasks.length})` : ''}`}>
        <OpsRead tasks={planned} onOpenPhoto={onOpenPhoto} />
      </InspectionSection>
    </>
  )
  return (
    <Layout
      isMobile={isMobile}
      top={<Header {...header} isMobile={isMobile} />}
      main={main}
      aside={<>{highlights}<InfoCard sheet={sheet} /></>}
    />
  )
}

function EditMode({ sheet, config, isMobile, onDone, onOpenPhoto, header }: {
  sheet: InspectionSheet; config: WearConfig; isMobile: boolean; onDone: () => void; onOpenPhoto: OpenPhoto; header: HeaderProps
}) {
  void onOpenPhoto
  const { value: wearInput } = useWearInput()
  const { canCorrect, openCorrectionModal } = useMileageCorrection(sheet.vehicle.id)
  const [forbidden, setForbidden] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const edit = useValidatedInspectionEdit(sheet, { wearConfig: config, vehicleType: sheet.vehicle.type ?? 'voiture', onForbidden: setForbidden })
  const { values, engine } = edit

  const finish = () => {
    edit.finish()
    onDone()
  }
  const done = (
    <Button color="cyan" mih={isMobile ? 48 : undefined} leftSection={<IconCheck size={18} />} onClick={finish}>Terminer</Button>
  )

  const levelErrors = engine.errors.map((error) => error.group).filter((group) => group.startsWith('levels.')).map((group) => group.split('.')[1] as LevelKey)
  const entry = sheet.mileage_entry
  const correctMileage = () => entry && openCorrectionModal({ id: entry.id, value: entry.value } as MileageEntry)
  const existingTaskIds = values.planned.map((task) => task.catalogTaskId).filter((id): id is number => id !== undefined)

  const main = (
    <>
      {isMobile && <EditBar engine={engine} />}
      <Alert color="orange" variant="light" icon={<IconInfoCircle size={18} />} p="xs">
        <Text fz={13.5}>Modifier cette fiche peut changer le statut d&apos;entretien du véhicule (usures, signalements).</Text>
      </Alert>
      {forbidden && <Alert color="red" icon={<IconLock size={18} />} role="alert">{forbidden}</Alert>}
      <InspectionSection id="km" title="Kilométrage">
        <Group gap="sm" wrap="wrap">
          <Text ff="monospace" fz={22} fw={800}>{sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—'}</Text>
          {canCorrect && entry && (
            <Button variant="subtle" color="cyan" mih={48} ml="auto" leftSection={<IconArrowUpRight size={18} />} onClick={correctMileage}>Corriger le kilométrage</Button>
          )}
        </Group>
        <Text fz={12.5} c="dimmed" lh={1.4}>Le kilométrage se modifie dans la correction kilométrique, pour garder l&apos;historique du véhicule cohérent.</Text>
      </InspectionSection>
      <InspectionSection id="levels" title="Niveaux">
        <EditField engine={engine} groups={['levels.oil', 'levels.coolant', 'levels.washer']} ring={false}>
          <LevelCheckGroup
            values={{ oil: values.oil, coolant: values.coolant, washer: values.washer }}
            errorKeys={levelErrors}
            onChange={(key, next) => edit.setLevel(key, LEVEL_LABELS[key], next)}
          />
        </EditField>
      </InspectionSection>
      <InspectionSection id="wear" title="Usure">
        {edit.measurableTasks.length === 0 ? <NoWear /> : (
          <SimpleGrid cols={isMobile ? 1 : 2} spacing="md">
            {edit.measurableTasks.map((task) => (
              <EditField key={task.id} engine={engine} groups={[`wear.${task.id}`]}>
                <WearTaskCard task={task} value={values.wear[task.id]} config={config} input={wearInput} onChange={(level) => edit.setWear(task, level, wearInput)} />
              </EditField>
            ))}
          </SimpleGrid>
        )}
      </InspectionSection>
      <InspectionSection id="lighting" title="Éclairage">
        <EditField engine={engine} groups={['lights']}>
          <BinaryToggle label="Éclairage" value={values.lightsOk} onChange={edit.setLights} />
        </EditField>
        {values.lightsOk === false && (
          <EditField engine={engine} groups={['lights_notes']} label="Notes">
            <Textarea
              aria-label="Éclairage · Notes"
              placeholder="Quel feu ?"
              value={values.lightsNotes}
              onChange={(event) => edit.typeText('lightsNotes', event.currentTarget.value)}
              onBlur={() => edit.setText('lightsNotes', 'lights_notes', 'Éclairage · Notes', values.lightsNotes)}
              minRows={2}
              autosize
            />
          </EditField>
        )}
      </InspectionSection>
      <InspectionSection id="damages" title={`Dégâts${values.damages.length ? ` (${values.damages.length})` : ''}`}>
        <InspectionDamagesEdit
          engine={engine}
          items={values.damages}
          onAdd={edit.addDamage}
          onType={edit.typeDamageDescription}
          onCommitDescription={edit.commitDamageDescription}
          onAddPhoto={edit.addDamagePhoto}
          onRemovePhoto={edit.removeDamagePhoto}
          onRemove={edit.removeDamage}
        />
      </InspectionSection>
      <InspectionSection id="road" title="Essai routier">
        <EditField engine={engine} groups={['roadtest']}>
          <BinaryToggle label="Essai routier" value={values.roadTestDone} onChange={edit.setRoadTest} okLabel="Réalisé" koLabel="Non réalisé" />
        </EditField>
        {values.roadTestDone === true && (
          <EditField engine={engine} groups={['road_notes']} label="Observations">
            <Textarea
              aria-label="Essai routier · Observations"
              placeholder="Observations (optionnel)…"
              value={values.roadTestNotes}
              onChange={(event) => edit.typeText('roadTestNotes', event.currentTarget.value)}
              onBlur={() => edit.setText('roadTestNotes', 'road_notes', 'Essai routier · Observations', values.roadTestNotes)}
              minRows={2}
              autosize
            />
          </EditField>
        )}
      </InspectionSection>
      <InspectionSection id="ops" title={`À prévoir${values.planned.length ? ` (${values.planned.length})` : ''}`}>
        <EditField engine={engine} groups={['ops']}>
          <Stack gap="sm">
            {values.planned.map((task) => (
              <EditField key={task.localId} engine={engine} groups={[`ops.${task.localId}`]}>
                <TaskCard
                  variant="planned"
                  task={task}
                  onChange={edit.changePlannedLocal}
                  onCommit={edit.persistPlanned}
                  onRemove={() => edit.removePlanned(task.localId)}
                  onConfirmPhotoRemoval={(proceed) => confirmRemoval('Supprimer cette photo ?', "La photo sera retirée de l'opération. Cette action est tracée.", proceed)}
                />
              </EditField>
            ))}
            <Button variant="light" mih={52} leftSection={<IconPlus size={18} />} disabled={!edit.catalogReady} onClick={() => setPickerOpen(true)}>Ajouter une opération</Button>
          </Stack>
        </EditField>
        <TaskPicker
          vehicleType={sheet.vehicle.type!}
          opened={pickerOpen}
          existingCatalogTaskIds={existingTaskIds}
          onClose={() => setPickerOpen(false)}
          onPick={(task) => edit.addPlanned({ ...task, type: 'planned' })}
        />
      </InspectionSection>
      {isMobile && <ErrorDock engine={engine} />}
    </>
  )
  return (
    <Layout
      isMobile={isMobile}
      top={<Header {...header} isMobile={isMobile} done={done} />}
      main={main}
      aside={<Paper withBorder radius="md" p="xs"><Stack gap="xs"><EditBar engine={engine} desk /><ErrorList engine={engine} /></Stack></Paper>}
    />
  )
}

export default InspectionShow
