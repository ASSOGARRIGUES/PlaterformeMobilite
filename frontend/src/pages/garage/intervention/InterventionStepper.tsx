import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBack } from '@refinedev/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stepper,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClipboardCheck,
  IconGauge,
  IconTool,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useInterventionStepper } from '../../../hooks/garage/useInterventionStepper'
import { StepMileage } from '../../../components/garage/stepper/StepMileage'
import { StepTasksDone } from '../../../components/garage/stepper/StepTasksDone'
import { StepTasksPlanned } from '../../../components/garage/stepper/StepTasksPlanned'
import { StepDatesValidate } from '../../../components/garage/stepper/StepDatesValidate'
import { MaintenanceWarningModal } from '../../../components/garage/MaintenanceWarningModal'
import { SaveButton } from '../../../components/SaveButton'

const STEP_LABELS = ['Kilométrage', 'Tâches réalisées', 'À prévoir', 'Dates & validation']
const STEP_ICONS = [IconGauge, IconTool, IconCalendar, IconClipboardCheck]

const InterventionStepper = () => {
  const { id } = useParams<{ id: string }>()
  const sheetId = Number(id)
  const back = useBack()
  const {
    sheet,
    vehicle,
    isLoading,
    isMutating,
    isSavingStep,
    doneTasks,
    plannedTasks,
    suggestions,
    activeStep,
    goToStep,
    addTask,
    updateTask,
    removeTask,
    validateSheet,
    warningModalProps,
    stepError,
  } = useInterventionStepper(sheetId)

  const [mileage, setMileage] = useState<number | ''>('')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [maxReachedStep, setMaxReachedStep] = useState(activeStep)
  const isDesktop = useMediaQuery('(min-width: 769px)')
  const stepIconSize = isDesktop ? 40 : 30

  // Préremplissage des champs à partir de la fiche chargée (une fois).
  // La date de départ est par défaut la date de création de la fiche.
  useEffect(() => {
    if (!sheet) return
    setMileage(sheet.start_mileage ?? '')
    setStartDate(dayjs(sheet.start_date ?? sheet.created_at).toDate())
    setEndDate(sheet.end_date ? dayjs(sheet.end_date).toDate() : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id])

  useEffect(() => {
    setMaxReachedStep((prev) => Math.max(prev, activeStep))
  }, [activeStep])

  if (isLoading || !sheet || !vehicle) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    )
  }

  const mileageInvalid = mileage === '' || mileage < vehicle.kilometer

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 800,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <Group gap="xs" p="md" style={{ flexShrink: 0 }}>
        <ActionIcon variant="subtle" onClick={back} aria-label="Retour">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={3}>Fiche d'intervention</Title>
      </Group>

      {stepError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} mx="md" mb="md" style={{ flexShrink: 0 }}>
          {stepError}
        </Alert>
      )}

      <Paper
        shadow="sm"
        m={{ base: 'xs', sm: 'md' }}
        mt={0}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ flexShrink: 0 }}>
          <Stepper
            active={activeStep}
            onStepClick={(step) => {
              if (isSavingStep || isMutating) return
              if (activeStep === 0 && mileageInvalid) return
              if (step <= maxReachedStep) goToStep(step)
            }}
            allowNextStepsSelect
            size="xs"
            iconSize={stepIconSize}
            styles={{
              root: { padding: '10px 16px 0' },
              steps: { gap: 0 },
              step: { padding: 0, cursor: 'pointer' },
              stepBody: { display: 'none' },
              separator: { marginInline: 4 },
            }}
          >
            {STEP_ICONS.map((Icon, index) => (
              <Stepper.Step
                key={STEP_LABELS[index]}
                aria-label={STEP_LABELS[index]}
                icon={activeStep === index && isSavingStep ? <Loader size={stepIconSize * 0.55} color="cyan" /> : <Icon size={stepIconSize * 0.55} />}
                completedIcon={<IconCheck size={stepIconSize * 0.55} />}
              />
            ))}
          </Stepper>
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            c="cyan.7"
            px="md"
            pb="xs"
            style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
          >
            Étape {activeStep + 1} sur {STEP_LABELS.length} — {STEP_LABELS[activeStep]}
          </Text>
        </div>

        <ScrollArea style={{ flex: 1, minHeight: 0 }} p="md">
          {activeStep === 0 && <StepMileage vehicle={vehicle} value={mileage} onChange={setMileage} />}

          {activeStep === 1 && (
            <StepTasksDone
              vehicle={vehicle}
              tasks={doneTasks}
              suggestions={suggestions}
              onAddTask={(task) => addTask(task, 'done')}
              onUpdateTask={(task) => updateTask(task.localId, task, 'done')}
              onRemoveTask={(localId) => removeTask(localId, 'done')}
              isMutating={isMutating}
            />
          )}

          {activeStep === 2 && (
            <StepTasksPlanned
              vehicle={vehicle}
              tasks={plannedTasks}
              onAddTask={(task) => addTask(task, 'planned')}
              onUpdateTask={(task) => updateTask(task.localId, task, 'planned')}
              onRemoveTask={(localId) => removeTask(localId, 'planned')}
              isMutating={isMutating}
            />
          )}

          {activeStep === 3 && (
            <StepDatesValidate
              startDate={startDate}
              endDate={endDate}
              onStartDate={setStartDate}
              onEndDate={setEndDate}
              vehicleImat={vehicle.imat}
              startMileage={sheet.start_mileage ?? (mileage === '' ? null : mileage)}
              doneTasks={doneTasks}
              plannedTasks={plannedTasks}
            />
          )}
        </ScrollArea>

        <Group
          justify="space-between"
          p="md"
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--mantine-color-gray-2)',
            paddingBottom: 'calc(var(--mantine-spacing-md) + env(safe-area-inset-bottom))',
          }}
        >
          {activeStep > 0 ? (
            <Button
              variant="default"
              style={{ minHeight: 48 }}
              disabled={isSavingStep || isMutating}
              onClick={() => goToStep(activeStep - 1)}
            >
              Retour
            </Button>
          ) : (
            <span />
          )}

          {activeStep === 0 && (
            <Button
              style={{ minHeight: 48 }}
              rightSection={<IconArrowRight size={16} />}
              disabled={mileageInvalid || isSavingStep || isMutating}
              onClick={() => goToStep(1, { start_mileage: Number(mileage) })}
            >
              Suivant
            </Button>
          )}
          {(activeStep === 1 || activeStep === 2) && (
            <Button
              style={{ minHeight: 48 }}
              rightSection={<IconArrowRight size={16} />}
              disabled={isSavingStep || isMutating}
              onClick={() => goToStep(activeStep + 1)}
            >
              Suivant
            </Button>
          )}
          {activeStep === 3 && (
            <SaveButton
              disabled={!startDate || isSavingStep || isMutating}
              onClick={() =>
                validateSheet({
                  start_date: dayjs(startDate).format('YYYY-MM-DD'),
                  end_date: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined,
                })
              }
            >
              Valider
            </SaveButton>
          )}
        </Group>
      </Paper>

      <MaintenanceWarningModal {...warningModalProps} />
    </div>
  )
}

export default InterventionStepper
