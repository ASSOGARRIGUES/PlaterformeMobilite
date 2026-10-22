import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useGo } from '@refinedev/core'
import { Alert, Box, Button, Center, Group, Loader, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { IconAlertTriangle, IconArrowRight, IconBulb, IconBulbOff, IconCheck, IconCircleCheck, IconCloudCheck, IconHome, IconRefresh, IconRoad, IconWifiOff } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import { InterventionStepperShell } from '../../../components/garage/stepper/InterventionStepperShell'
import { StepMileage } from '../../../components/garage/stepper/StepMileage'
import { BinaryToggle } from '../../../components/garage/inspection/BinaryToggle'
import { DamageList } from '../../../components/garage/inspection/DamageList'
import { ExpiredSheetScreen } from '../../../components/garage/inspection/ExpiredSheetScreen'
import { InspectionProgress } from '../../../components/garage/inspection/InspectionProgress'
import { InspectionSummary } from '../../../components/garage/inspection/InspectionSummary'
import { LevelCheckGroup } from '../../../components/garage/inspection/LevelCheckGroup'
import { PlannedOpsStep } from '../../../components/garage/inspection/PlannedOpsStep'
import { SaveErrorAlert } from '../../../components/garage/inspection/SaveErrorAlert'
import { WearStepBody } from '../../../components/garage/inspection/WearStepBody'
import { useInspectionStepper } from '../../../hooks/garage/useInspectionStepper'
import { useWearInput } from '../../../hooks/garage/useWearInput'
import { useWearPerPage } from '../../../hooks/garage/useWearPerPage'
import { INSPECTION_STEP_COUNT, INSPECTION_STEP_LABELS, WEAR_STEP } from '../../../hooks/garage/inspectionStepperUtils'

dayjs.extend(relativeTime)
dayjs.locale('fr')

const LAST_STEP = INSPECTION_STEP_COUNT - 1
const RESUME_TOAST_MS = 4000

const STEP_HINTS: Record<number, string> = {
  0: 'Relevez le compteur du véhicule.',
  1: 'État des niveaux moteur.',
  3: 'Feux, clignotants, stops.',
  4: 'Carrosserie, vitrage, intérieur.',
  5: 'Essai routier réalisé ?',
}

function StepHeading({ step }: { step: number }) {
  return (
    <Stack gap={4} mb="md">
      <Text fz={12} fw={700} tt="uppercase" c="cyan.7">
        Étape {step + 1} sur {INSPECTION_STEP_COUNT}
      </Text>
      <Title order={3}>{INSPECTION_STEP_LABELS[step]}</Title>
      {STEP_HINTS[step] && <Text c="dimmed" size="sm">{STEP_HINTS[step]}</Text>}
    </Stack>
  )
}

const InspectionStepper = () => {
  const { id } = useParams<{ id: string }>()
  const sheetId = Number(id)
  const go = useGo()
  const { value: wearInput } = useWearInput()
  const perPage = useWearPerPage()
  const s = useInspectionStepper(sheetId, perPage)
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    if (s.resumedFromStep == null) return
    setToastVisible(true)
    const timer = setTimeout(() => setToastVisible(false), RESUME_TOAST_MS)
    return () => clearTimeout(timer)
  }, [s.resumedFromStep])

  if (s.loadFailed) {
    return (
      <Stack align="center" gap="md" p="lg" ta="center">
        <Text>Impossible de charger la fiche de contrôle. Vérifiez la connexion.</Text>
        <Button mih={48} leftSection={<IconRefresh size={18} />} onClick={s.reload}>Réessayer</Button>
        <Button mih={48} variant="default" onClick={s.goHome}>Retour au garage</Button>
      </Stack>
    )
  }

  if (s.isLoading && !s.isExpired) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    )
  }

  if (s.isDone) {
    return (
      <Stack align="center" justify="center" gap={14} px="lg" mih="60vh" ta="center">
        <Box c="teal.7"><IconCircleCheck size={72} aria-hidden /></Box>
        <Title order={2}>Fiche enregistrée</Title>
        <Text c="dimmed" maw={300}>La fiche a été envoyée et ajoutée à l&apos;historique du véhicule.</Text>
        <Button color="cyan" mih={48} leftSection={<IconHome size={18} />} onClick={s.goHome}>
          Retour à l&apos;accueil
        </Button>
      </Stack>
    )
  }

  // Une fiche validée se consulte (et se corrige) depuis la fiche du véhicule : plus de cul-de-sac « déjà validée » (story 3.3).
  if (s.sheet?.status === 'validated') {
    return <Navigate to={`/vehicle/${s.sheet.vehicle.id}/inspection/${s.sheet.id}`} replace />
  }

  if (s.isExpired && s.sheet) {
    return (
      <ExpiredSheetScreen
        imat={s.sheet.vehicle.imat}
        openedAt={dayjs(s.sheet.created_at).fromNow()}
        onNew={() => go({ to: '/garage/inspection/create' })}
      />
    )
  }

  const { sheet, vehicle, config, draft, activeStep, viewStep } = s
  if (!sheet || !vehicle || !config) return null

  const onWearStep = s.activeStep === WEAR_STEP && !s.recapView
  const showRecap = s.recapView
  const retryable = s.stepError?.retryable === true
  const offlineOnRecap = showRecap && !s.isOnline
  const missingMileage = activeStep === 0 && !showRecap && (draft.startMileage == null || draft.startMileage < 0)

  const nextLabel = retryable ? 'Réessayer' : activeStep === LAST_STEP && !showRecap ? 'Vérifier' : 'Suivant'

  const footer = (
    <>
      {s.activeStep === 0 && !showRecap ? (
        <Button variant="default" mih={48} onClick={s.goHome} disabled={s.isBusy}>Quitter</Button>
      ) : (
        <Button variant="default" mih={48} onClick={() => void s.goBack()} disabled={s.isBusy}>Retour</Button>
      )}
      {showRecap ? (
        <Button
          color="cyan"
          mih={48}
          style={{ flex: 2 }}
          leftSection={<IconCheck size={18} />}
          disabled={offlineOnRecap || s.isBusy}
          aria-disabled={offlineOnRecap || s.isBusy}
          onClick={() => void s.validateSheet()}
        >
          Valider la fiche
        </Button>
      ) : (
        <Button
          color="cyan"
          mih={48}
          style={{ flex: 2 }}
          rightSection={retryable ? <IconRefresh size={16} /> : <IconArrowRight size={16} />}
          disabled={missingMileage || s.isBusy}
          onClick={() => void (retryable ? s.retry() : s.goNext())}
        >
          {nextLabel}
        </Button>
      )}
    </>
  )

  const footerAlert = (
    <>
      {s.stepError && <SaveErrorAlert error={s.stepError} compact={onWearStep} onFix={s.jumpToStep} />}
      {offlineOnRecap && (
        <Alert color="gray" icon={<IconWifiOff size={18} />} mx="md" mb={10} style={{ flexShrink: 0 }}>
          <b>Validation impossible hors ligne.</b> Reconnectez-vous pour valider la fiche.
        </Alert>
      )}
    </>
  )

  return (
    <>
      <InterventionStepperShell
        title={
          <>
            Contrôle{' '}
            <Text component="span" ff="monospace" fz="sm" className="sentry-mask">{vehicle.imat}</Text>
          </>
        }
        onBack={() => (showRecap || activeStep > 0 ? void s.goBack() : s.goHome())}
        stepError={null}
        progress={<InspectionProgress step={viewStep} total={INSPECTION_STEP_COUNT} saveState={s.saveState} />}
        footerAlert={footerAlert}
        footer={footer}
      >
        {showRecap && (
          <InspectionSummary
            draft={draft}
            tasks={s.measurableTasks}
            damages={s.damages}
            damageChoice={s.damageChoice}
            plannedTasks={s.plannedTasks}
            config={config}
            input={wearInput}
            moreRecentEntry={s.moreRecentEntry}
          />
        )}

        {!showRecap && !onWearStep && <StepHeading step={activeStep} />}

        {!showRecap && activeStep === 0 && (
          <StepMileage
            vehicle={vehicle}
            value={draft.startMileage ?? ''}
            onChange={(value) => s.setDraft((current) => ({ ...current, startMileage: value === '' ? null : value }))}
            startDate={null}
            onStartDate={() => undefined}
            moreRecentEntry={s.moreRecentEntry}
            hideDate
            onSubmit={() => {
              if (!missingMileage && !s.isBusy) void s.goNext()
            }}
          />
        )}

        {!showRecap && activeStep === 1 && (
          <LevelCheckGroup
            values={{ oil: draft.oil, coolant: draft.coolant, washer: draft.washer }}
            onChange={(key, value) => s.setDraft((current) => ({ ...current, [key]: value }))}
          />
        )}

        {onWearStep && (
          <WearStepBody
            tasks={s.measurableTasks}
            values={draft.wear}
            onSet={(taskId, value) =>
              s.setDraft((current) => {
                const wear = { ...current.wear }
                if (value == null) delete wear[taskId]
                else wear[taskId] = value
                return { ...current, wear }
              })
            }
            page={s.wearPage}
            perPage={perPage}
            input={wearInput}
            config={config}
            last={s.lastWear}
          />
        )}

        {!showRecap && activeStep === 3 && (
          <Stack gap="md">
            <BinaryToggle
              label="Éclairage"
              value={draft.lightsOk}
              onChange={(value) => s.setDraft((current) => ({ ...current, lightsOk: value, lightsNotes: value ? '' : current.lightsNotes }))}
              okIcon={IconBulb}
              koIcon={IconBulbOff}
            />
            {draft.lightsOk === false && (
              <Textarea
                aria-label="Défaut constaté (optionnel)"
                placeholder="Quel défaut ? (optionnel)"
                value={draft.lightsNotes}
                onChange={(event) => s.setDraft((current) => ({ ...current, lightsNotes: event.currentTarget.value }))}
                minRows={2}
                autosize
              />
            )}
          </Stack>
        )}

        {!showRecap && activeStep === 4 && (
          <Stack gap="md">
            <BinaryToggle
              label="Dégâts"
              value={s.damageChoice === null ? null : s.damageChoice === 'none'}
              onChange={(value) => s.setDamageChoice(value ? 'none' : 'report')}
              okLabel="Aucun"
              koLabel="À signaler"
              koIcon={IconAlertTriangle}
            />
            {s.damageChoice === 'report' && (
              <DamageList items={s.damages} onChange={s.setDamages} invalidIndex={s.invalidDamageIndex} />
            )}
          </Stack>
        )}

        {!showRecap && activeStep === 5 && (
          <Stack gap="md">
            <BinaryToggle
              label="Essai routier"
              value={draft.roadTestDone}
              onChange={(value) => s.setDraft((current) => ({ ...current, roadTestDone: value }))}
              okLabel="Réalisé"
              koLabel="Non réalisé"
              okIcon={IconRoad}
            />
            {draft.roadTestDone === true && (
              <Textarea
                aria-label="Observations (optionnel)"
                placeholder="Observations (optionnel)…"
                value={draft.roadTestNotes}
                onChange={(event) => s.setDraft((current) => ({ ...current, roadTestNotes: event.currentTarget.value }))}
                minRows={2}
                autosize
              />
            )}
          </Stack>
        )}

        {!showRecap && activeStep === LAST_STEP && (
          <PlannedOpsStep
            vehicle={vehicle}
            tasks={s.plannedTasks}
            isMutating={s.isBusy}
            onAdd={s.addPlanned}
            onChange={s.updatePlanned}
            onRemove={(localId) => void s.removePlanned(localId)}
          />
        )}
      </InterventionStepperShell>

      {toastVisible && s.resumedFromStep != null && (
        <Paper
          role="status"
          bg="gray.8"
          c="white"
          radius="md"
          p="sm"
          shadow="md"
          style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 300 }}
        >
          <Group gap={10} wrap="nowrap">
            <IconCloudCheck size={19} color="var(--mantine-color-teal-5)" aria-hidden />
            <Text fz={13.5}>Fiche reprise à l&apos;étape {s.resumedFromStep}</Text>
          </Group>
        </Paper>
      )}
    </>
  )
}

export default InspectionStepper
