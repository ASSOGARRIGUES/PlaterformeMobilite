import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBack, useList } from '@refinedev/core'
import { Button, Center, Loader } from '@mantine/core'
import {
  IconArrowRight,
  IconCalendar,
  IconCalendarTime,
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
import { InterventionStepperShell } from '../../../components/garage/stepper/InterventionStepperShell'
import { InterventionSidePanel } from '../../../components/garage/stepper/InterventionSidePanel'
import { SaveButton } from '../../../components/SaveButton'
import { InterventionShow } from './InterventionShow'
import { MileageEntry } from '../../../types/garage'

// Même découpage 5 étapes sur mobile et desktop (cf. story 2.8 + revue mobile/desktop) : "Récapitulatif"
// est une sous-vue locale de l'étape modèle 3 (cf. `recapView` ci-dessous) — le modèle persisté
// (current_step) reste sur 4 étapes.
const STEP_LABELS = ['Kilométrage', 'Tâches réalisées', 'À prévoir', 'Dates', 'Récapitulatif']
const STEP_ICONS = [IconGauge, IconTool, IconCalendar, IconCalendarTime, IconClipboardCheck]

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
    history,
    catalogById,
    activeStep,
    goToStep,
    addTask,
    updateTask,
    removeTask,
    validateSheet,
    stepError,
  } = useInterventionStepper(sheetId)

  const [mileage, setMileage] = useState<number | ''>('')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [maxReachedStep, setMaxReachedStep] = useState(activeStep)
  // Sous-vue locale de l'étape modèle 3 (Dates/Récapitulatif) — `current_step` persisté
  // ne dépasse jamais 4 (cf. commentaire STEP_LABELS ci-dessus)
  const [recapView, setRecapView] = useState(false)

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

  useEffect(() => {
    if (activeStep !== 3) setRecapView(false)
  }, [activeStep])

  const viewStep = activeStep === 3 && recapView ? 4 : activeStep

  // Dernier relevé du véhicule (le modèle est trié par -date, -id) : si sa date est postérieure
  // à la date de début, le relevé créé à la validation ne mettra pas à jour Vehicle.kilometer.
  const { data: latestMileageData } = useList<MileageEntry>({
    resource: `garage/mileage/${vehicle?.id}`,
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!vehicle },
  })
  const latestMileageEntry = latestMileageData?.data[0]
  const moreRecentEntry =
    latestMileageEntry && startDate && dayjs(latestMileageEntry.date).isAfter(startDate, 'day')
      ? latestMileageEntry
      : null

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

  const mileageInvalid = mileage === '' || mileage < 0 || !startDate

  const validateWithDates = () =>
    validateSheet({
      start_date: dayjs(startDate).format('YYYY-MM-DD'),
      end_date: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined,
    })

  const footer = (
    <>
      {viewStep > 0 ? (
        <Button
          variant="default"
          style={{ minHeight: 48 }}
          disabled={isSavingStep || isMutating}
          onClick={() => (viewStep === 4 ? setRecapView(false) : goToStep(activeStep - 1))}
        >
          Retour
        </Button>
      ) : (
        <span />
      )}

      {viewStep === 0 && (
        <Button
          style={{ minHeight: 48 }}
          rightSection={<IconArrowRight size={16} />}
          disabled={mileageInvalid || isSavingStep || isMutating}
          onClick={() =>
            goToStep(1, { start_mileage: Number(mileage), start_date: dayjs(startDate).format('YYYY-MM-DD') })
          }
        >
          Suivant
        </Button>
      )}
      {(viewStep === 1 || viewStep === 2) && (
        <Button
          style={{ minHeight: 48 }}
          rightSection={<IconArrowRight size={16} />}
          disabled={isSavingStep || isMutating}
          onClick={() => goToStep(activeStep + 1)}
        >
          Suivant
        </Button>
      )}
      {viewStep === 3 && (
        <Button
          style={{ minHeight: 48 }}
          rightSection={<IconArrowRight size={16} />}
          disabled={isSavingStep || isMutating}
          onClick={() => setRecapView(true)}
        >
          Vérifier
        </Button>
      )}
      {viewStep === 4 && (
        <SaveButton disabled={!startDate || isSavingStep || isMutating} onClick={validateWithDates}>
          Valider l&apos;intervention
        </SaveButton>
      )}
    </>
  )

  const sidePanel = (
    <InterventionSidePanel
      vehicle={vehicle}
      plannedTasks={plannedTasks}
      suggestions={suggestions}
      history={history}
      catalogById={catalogById}
      activeStep={viewStep}
    />
  )

  return (
    <>
      <InterventionStepperShell
        title="Fiche d'intervention"
        onBack={back}
        stepError={stepError}
        stepLabels={STEP_LABELS}
        stepIcons={STEP_ICONS}
        activeStep={viewStep}
        onStepClick={(step) => {
          if (isSavingStep || isMutating) return
          if (activeStep === 0 && mileageInvalid) return
          if (step === 4) {
            if (maxReachedStep < 3) return
            setRecapView(true)
            if (activeStep !== 3) goToStep(3)
            return
          }
          if (step > maxReachedStep) return
          setRecapView(false)
          if (step !== activeStep) goToStep(step)
        }}
        isStepLoading={(step) => step === viewStep && isSavingStep}
        footer={footer}
        sidePanel={sidePanel}
      >
        {viewStep === 0 && (
          <StepMileage
            vehicle={vehicle}
            value={mileage}
            onChange={setMileage}
            startDate={startDate}
            onStartDate={setStartDate}
            moreRecentEntry={moreRecentEntry}
          />
        )}

        {viewStep === 1 && (
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

        {viewStep === 2 && (
          <StepTasksPlanned
            vehicle={vehicle}
            tasks={plannedTasks}
            onAddTask={(task) => addTask(task, 'planned')}
            onUpdateTask={(task) => updateTask(task.localId, task, 'planned')}
            onRemoveTask={(localId) => removeTask(localId, 'planned')}
            isMutating={isMutating}
          />
        )}

        {viewStep === 3 && (
          <StepDatesValidate
            startDate={startDate}
            endDate={endDate}
            onStartDate={setStartDate}
            onEndDate={setEndDate}
            vehicleImat={vehicle.imat}
            startMileage={sheet.start_mileage ?? (mileage === '' ? null : mileage)}
            doneTasks={doneTasks}
            plannedTasks={plannedTasks}
            mode="dates"
            moreRecentEntry={moreRecentEntry}
          />
        )}

        {viewStep === 4 && (
          <StepDatesValidate
            startDate={startDate}
            endDate={endDate}
            onStartDate={setStartDate}
            onEndDate={setEndDate}
            vehicleImat={vehicle.imat}
            startMileage={sheet.start_mileage ?? (mileage === '' ? null : mileage)}
            doneTasks={doneTasks}
            plannedTasks={plannedTasks}
            mode="recap"
            moreRecentEntry={moreRecentEntry}
          />
        )}
      </InterventionStepperShell>
    </>
  )
}

export default InterventionStepper
