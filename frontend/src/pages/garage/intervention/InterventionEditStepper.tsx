import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGo } from '@refinedev/core'
import { Alert, Button, Center, Loader, NumberInput, Tooltip } from '@mantine/core'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendar,
  IconCalendarTime,
  IconClipboardCheck,
  IconGauge,
  IconTool,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useValidatedInterventionEdit } from '../../../hooks/garage/useValidatedInterventionEdit'
import { StepTasksDone } from '../../../components/garage/stepper/StepTasksDone'
import { StepTasksPlanned } from '../../../components/garage/stepper/StepTasksPlanned'
import { StepDatesValidate } from '../../../components/garage/stepper/StepDatesValidate'
import { InterventionStepperShell } from '../../../components/garage/stepper/InterventionStepperShell'
import { InterventionSidePanel } from '../../../components/garage/stepper/InterventionSidePanel'
import { humanizeDate } from '../../../constants'

// Même découpage 5 étapes sur mobile et desktop que InterventionStepper (cohérence de chrome)
const STEP_LABELS = ['Kilométrage', 'Tâches réalisées', 'À prévoir', 'Dates', 'Récapitulatif']
const STEP_ICONS = [IconGauge, IconTool, IconCalendar, IconCalendarTime, IconClipboardCheck]

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
    history,
    catalogById,
    stepError,
    activeStep,
    goToStep,
  } = useValidatedInterventionEdit(sheetId)

  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  // Sous-vue locale de l'étape 3 (Dates/Récapitulatif) — même pattern que InterventionStepper
  const [recapView, setRecapView] = useState(false)

  useEffect(() => {
    if (!sheet) return
    setStartDate(dayjs(sheet.start_date ?? sheet.created_at).toDate())
    setEndDate(sheet.end_date ? dayjs(sheet.end_date).toDate() : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id])

  useEffect(() => {
    if (activeStep !== 3) setRecapView(false)
  }, [activeStep])

  const viewStep = activeStep === 3 && recapView ? 4 : activeStep

  // Une date refusée par le serveur (ex : date de début effacée) est rétablie à l'écran
  const onStartDate = async (value: Date | null) => {
    const previous = startDate
    setStartDate(value)
    const saved = await updateSheetField('start_date', value ? dayjs(value).format('YYYY-MM-DD') : null)
    if (!saved) setStartDate(previous)
  }

  const onEndDate = async (value: Date | null) => {
    const previous = endDate
    setEndDate(value)
    const saved = await updateSheetField('end_date', value ? dayjs(value).format('YYYY-MM-DD') : null)
    if (!saved) setEndDate(previous)
  }

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
      {viewStep > 0 ? (
        <Button
          variant="default"
          style={{ minHeight: 48 }}
          onClick={() => (viewStep === 4 ? setRecapView(false) : goToStep(activeStep - 1))}
        >
          Retour
        </Button>
      ) : (
        <span />
      )}

      {viewStep < 3 && (
        <Button
          style={{ minHeight: 48 }}
          rightSection={<IconArrowRight size={16} />}
          onClick={() => goToStep(activeStep + 1)}
        >
          Suivant
        </Button>
      )}
      {viewStep === 3 && (
        <Button style={{ minHeight: 48 }} rightSection={<IconArrowRight size={16} />} onClick={() => setRecapView(true)}>
          Vérifier
        </Button>
      )}
      {viewStep === 4 && (
        <Button style={{ minHeight: 48 }} onClick={goBack}>
          Terminer
        </Button>
      )}
    </>
  )

  const sidePanel = (
    <InterventionSidePanel
      vehicle={vehicle}
      plannedTasks={plannedTasks}
      history={history}
      catalogById={catalogById}
      activeStep={viewStep}
    />
  )

  return (
    <InterventionStepperShell
      title={`Modifier — ${vehicle.imat}`}
      maskTitle
      onBack={goBack}
      stepError={stepError}
      extraAlert={extraAlert}
      stepLabels={STEP_LABELS}
      stepIcons={STEP_ICONS}
      activeStep={viewStep}
      onStepClick={(step) => {
        if (step === 4) {
          setRecapView(true)
          if (activeStep !== 3) goToStep(3)
          return
        }
        setRecapView(false)
        if (step !== activeStep) goToStep(step)
      }}
      footer={footer}
      sidePanel={sidePanel}
    >
      {viewStep === 0 && (
        <Tooltip label="Pour corriger le kilométrage, utilisez la correction kilométrique depuis la fiche véhicule">
          <NumberInput label="Kilométrage" value={sheet.start_mileage ?? undefined} disabled thousandSeparator=" " />
        </Tooltip>
      )}

      {viewStep === 1 && (
        <StepTasksDone
          vehicle={vehicle}
          tasks={doneTasks}
          onAddTask={(task) => addTask(task, 'done')}
          onUpdateTask={(task) => updateTaskLocal(task.localId, task, 'done')}
          onCommitTask={(task) => persistTask(task.localId, 'done', task)}
          onRemoveTask={(localId) => removeTask(localId, 'done')}
          isMutating={isMutating}
        />
      )}

      {viewStep === 2 && (
        <StepTasksPlanned
          vehicle={vehicle}
          tasks={plannedTasks}
          onAddTask={(task) => addTask(task, 'planned')}
          onUpdateTask={(task) => updateTaskLocal(task.localId, task, 'planned')}
          onCommitTask={(task) => persistTask(task.localId, 'planned', task)}
          onRemoveTask={(localId) => removeTask(localId, 'planned')}
          isMutating={isMutating}
        />
      )}

      {viewStep === 3 && (
        <StepDatesValidate
          startDate={startDate}
          endDate={endDate}
          onStartDate={onStartDate}
          onEndDate={onEndDate}
          vehicleImat={vehicle.imat}
          startMileage={sheet.start_mileage ?? null}
          doneTasks={doneTasks}
          plannedTasks={plannedTasks}
          mode="dates"
        />
      )}

      {viewStep === 4 && (
        <StepDatesValidate
          startDate={startDate}
          endDate={endDate}
          onStartDate={onStartDate}
          onEndDate={onEndDate}
          vehicleImat={vehicle.imat}
          startMileage={sheet.start_mileage ?? null}
          doneTasks={doneTasks}
          plannedTasks={plannedTasks}
          mode="recap"
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
