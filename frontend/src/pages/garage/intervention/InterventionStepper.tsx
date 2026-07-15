import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBack } from '@refinedev/core'
import { ActionIcon, Alert, Button, Center, Group, Loader, Paper, Stack, Stepper, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useInterventionStepper } from '../../../hooks/garage/useInterventionStepper'
import { StepMileage } from '../../../components/garage/stepper/StepMileage'
import { StepTasksDone } from '../../../components/garage/stepper/StepTasksDone'
import { StepTasksPlanned } from '../../../components/garage/stepper/StepTasksPlanned'
import { StepDatesValidate } from '../../../components/garage/stepper/StepDatesValidate'
import { MaintenanceWarningModal } from '../../../components/garage/MaintenanceWarningModal'
import { SaveButton } from '../../../components/SaveButton'

const InterventionStepper = () => {
  const { id } = useParams<{ id: string }>()
  const sheetId = Number(id)
  const back = useBack()
  const {
    sheet,
    vehicle,
    isLoading,
    isMutating,
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

  // Préremplissage des champs à partir de la fiche chargée (une fois).
  // La date de départ est par défaut la date de création de la fiche.
  useEffect(() => {
    if (!sheet) return
    setMileage(sheet.start_mileage ?? '')
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

  const mileageInvalid = mileage === '' || mileage < vehicle.kilometer

  return (
    <Stack p="md" maw={800} mx="auto" w="100%">
      <Group gap="xs">
        <ActionIcon variant="subtle" onClick={back} aria-label="Retour">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={3}>Fiche d'intervention</Title>
      </Group>

      {stepError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {stepError}
        </Alert>
      )}

      <Paper shadow="sm" p="md">
        <Stepper active={activeStep} size="sm" allowNextStepsSelect={false}>
          <Stepper.Step label="Kilométrage">
            <StepMileage vehicle={vehicle} value={mileage} onChange={setMileage} />
          </Stepper.Step>

          <Stepper.Step label="Tâches réalisées">
            <StepTasksDone
              vehicle={vehicle}
              tasks={doneTasks}
              suggestions={suggestions}
              onAddTask={(task) => addTask(task, 'done')}
              onUpdateTask={(task) => updateTask(task.localId, task, 'done')}
              onRemoveTask={(localId) => removeTask(localId, 'done')}
              isMutating={isMutating}
            />
          </Stepper.Step>

          <Stepper.Step label="À prévoir">
            <StepTasksPlanned
              vehicle={vehicle}
              tasks={plannedTasks}
              onAddTask={(task) => addTask(task, 'planned')}
              onUpdateTask={(task) => updateTask(task.localId, task, 'planned')}
              onRemoveTask={(localId) => removeTask(localId, 'planned')}
              isMutating={isMutating}
            />
          </Stepper.Step>

          <Stepper.Step label="Dates & validation">
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
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between" mt="xl">
          {activeStep > 0 ? (
            <Button variant="default" style={{ minHeight: 48 }} onClick={() => goToStep(activeStep - 1)}>
              Retour
            </Button>
          ) : (
            <span />
          )}

          {activeStep === 0 && (
            <Button
              style={{ minHeight: 48 }}
              disabled={mileageInvalid}
              onClick={() => goToStep(1, { start_mileage: Number(mileage) })}
            >
              Suivant
            </Button>
          )}
          {(activeStep === 1 || activeStep === 2) && (
            <Button style={{ minHeight: 48 }} onClick={() => goToStep(activeStep + 1)}>
              Suivant
            </Button>
          )}
          {activeStep === 3 && (
            <SaveButton
              disabled={!startDate}
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
    </Stack>
  )
}

export default InterventionStepper
