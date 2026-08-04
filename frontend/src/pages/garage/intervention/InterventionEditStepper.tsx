import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGo } from '@refinedev/core'
import { Alert, Button, Center, Loader, NumberInput, Tooltip } from '@mantine/core'
import { IconAlertTriangle, IconArrowRight } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useValidatedInterventionEdit } from '../../../hooks/garage/useValidatedInterventionEdit'
import { StepTasksDone } from '../../../components/garage/stepper/StepTasksDone'
import { StepTasksPlanned } from '../../../components/garage/stepper/StepTasksPlanned'
import { StepDatesValidate } from '../../../components/garage/stepper/StepDatesValidate'
import { InterventionStepperShell } from '../../../components/garage/stepper/InterventionStepperShell'
import { humanizeDate } from '../../../constants'

const STEP_LABELS = ['Kilométrage', 'Tâches réalisées', 'À prévoir', 'Dates & récapitulatif']

type InterventionEditStepperProps = {
  sheetId: number
}

export function InterventionEditStepper({ sheetId }: InterventionEditStepperProps) {
  const go = useGo()
  const {
    sheet,
    vehicle,
    isLoading,
    isMutating,
    doneTasks,
    plannedTasks,
    updateSheetField,
    addTask,
    updateTaskLocal,
    persistTask,
    removeTask,
    moreRecentSheet,
    stepError,
    activeStep,
    goToStep,
  } = useValidatedInterventionEdit(sheetId)

  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  useEffect(() => {
    if (!sheet) return
    setStartDate(dayjs(sheet.start_date ?? sheet.created_at).toDate())
    setEndDate(sheet.end_date ? dayjs(sheet.end_date).toDate() : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id])

  if (isLoading || !sheet || !vehicle) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    )
  }

  const goBack = () => go({ to: `/garage/intervention/${sheetId}` })

  const extraAlert = moreRecentSheet && (
    <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mx="md" mb="md" style={{ flexShrink: 0 }}>
      Une intervention plus récente existe sur ce véhicule ({humanizeDate(moreRecentSheet.created_at)}). Toute
      tâche ajoutée ou modifiée ici ne sera prise en compte que jusqu'à cette date.
    </Alert>
  )

  const footer = (
    <>
      {activeStep > 0 ? (
        <Button variant="default" style={{ minHeight: 48 }} onClick={() => goToStep(activeStep - 1)}>
          Retour
        </Button>
      ) : (
        <span />
      )}

      {activeStep < 3 ? (
        <Button
          style={{ minHeight: 48 }}
          rightSection={<IconArrowRight size={16} />}
          onClick={() => goToStep(activeStep + 1)}
        >
          Suivant
        </Button>
      ) : (
        <Button style={{ minHeight: 48 }} onClick={goBack}>
          Terminer
        </Button>
      )}
    </>
  )

  return (
    <InterventionStepperShell
      title={`Modifier — ${vehicle.imat}`}
      maskTitle
      onBack={goBack}
      stepError={stepError}
      extraAlert={extraAlert}
      stepLabels={STEP_LABELS}
      activeStep={activeStep}
      onStepClick={goToStep}
      footer={footer}
    >
      {activeStep === 0 && (
        <Tooltip label="Pour corriger le kilométrage, utilisez la correction kilométrique depuis la fiche véhicule">
          <NumberInput label="Kilométrage" value={sheet.start_mileage ?? undefined} disabled thousandSeparator=" " />
        </Tooltip>
      )}

      {activeStep === 1 && (
        <StepTasksDone
          vehicle={vehicle}
          tasks={doneTasks}
          suggestions={[]}
          onAddTask={(task) => addTask(task, 'done')}
          onUpdateTask={(task) => updateTaskLocal(task.localId, task, 'done')}
          onCommitTask={(task) => persistTask(task.localId, 'done')}
          onRemoveTask={(localId) => removeTask(localId, 'done')}
          isMutating={isMutating}
        />
      )}

      {activeStep === 2 && (
        <StepTasksPlanned
          vehicle={vehicle}
          tasks={plannedTasks}
          onAddTask={(task) => addTask(task, 'planned')}
          onUpdateTask={(task) => updateTaskLocal(task.localId, task, 'planned')}
          onCommitTask={(task) => persistTask(task.localId, 'planned')}
          onRemoveTask={(localId) => removeTask(localId, 'planned')}
          isMutating={isMutating}
        />
      )}

      {activeStep === 3 && (
        <StepDatesValidate
          startDate={startDate}
          endDate={endDate}
          onStartDate={(value) => {
            setStartDate(value)
            updateSheetField('start_date', value ? dayjs(value).format('YYYY-MM-DD') : null)
          }}
          onEndDate={(value) => {
            setEndDate(value)
            updateSheetField('end_date', value ? dayjs(value).format('YYYY-MM-DD') : null)
          }}
          vehicleImat={vehicle.imat}
          startMileage={sheet.start_mileage ?? null}
          doneTasks={doneTasks}
          plannedTasks={plannedTasks}
        />
      )}
    </InterventionStepperShell>
  )
}

const InterventionEditStepperRoute = () => {
  const { id } = useParams<{ id: string }>()
  return <InterventionEditStepper sheetId={Number(id)} />
}

export default InterventionEditStepperRoute
