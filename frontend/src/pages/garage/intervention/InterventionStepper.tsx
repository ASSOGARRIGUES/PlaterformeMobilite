import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBack } from '@refinedev/core'
import { Button, Center, Loader } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useInterventionStepper } from '../../../hooks/garage/useInterventionStepper'
import { StepMileage } from '../../../components/garage/stepper/StepMileage'
import { StepTasksDone } from '../../../components/garage/stepper/StepTasksDone'
import { StepTasksPlanned } from '../../../components/garage/stepper/StepTasksPlanned'
import { StepDatesValidate } from '../../../components/garage/stepper/StepDatesValidate'
import { InterventionStepperShell } from '../../../components/garage/stepper/InterventionStepperShell'
import { MaintenanceWarningModal } from '../../../components/garage/MaintenanceWarningModal'
import { SaveButton } from '../../../components/SaveButton'
import { InterventionShow } from './InterventionShow'

const STEP_LABELS = ['Kilométrage', 'Tâches réalisées', 'À prévoir', 'Dates & validation']

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

  if (sheet.status === 'validated') {
    return <InterventionShow sheetId={sheetId} />
  }

  const mileageInvalid = mileage === '' || mileage < vehicle.kilometer

  const footer = (
    <>
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
    </>
  )

  return (
    <>
      <InterventionStepperShell
        title="Fiche d'intervention"
        onBack={back}
        stepError={stepError}
        stepLabels={STEP_LABELS}
        activeStep={activeStep}
        onStepClick={(step) => {
          if (isSavingStep || isMutating) return
          if (activeStep === 0 && mileageInvalid) return
          if (step <= maxReachedStep) goToStep(step)
        }}
        isStepLoading={(step) => step === activeStep && isSavingStep}
        footer={footer}
      >
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
      </InterventionStepperShell>

      <MaintenanceWarningModal {...warningModalProps} />
    </>
  )
}

export default InterventionStepper
