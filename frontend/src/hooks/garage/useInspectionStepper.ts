import { useEffect, useMemo, useRef, useState } from 'react'
import { useApiUrl, useCustom, useCustomMutation, useGo, useInvalidate, useList, useOne, useShow, useUpdate } from '@refinedev/core'
import { showNotification } from '@mantine/notifications'
import dayjs from 'dayjs'
import {
  InspectionSheet,
  LocalDamage,
  LocalTask,
  MaintenanceSummary,
  MeasurableTask,
  MileageEntry,
  ValidateInspectionResponse,
} from '../../types/garage'
import { TaskCatalogItem } from '../../components/garage/taskCardUtils'
import { SaveState } from '../../components/garage/inspection/SaveStatus'
import { StepErrorState } from '../../components/garage/inspection/SaveErrorAlert'
import { useGarageConfig } from './useGarageConfig'
import { useOnlineStatus } from './useOnlineStatus'
import { useStepperView } from './useStepperView'
import { errorStatus, extractFieldErrors, extractStepError, isRetryableError, localTaskToUpdatePayload } from './interventionStepperUtils'
import {
  INSPECTION_STEP_COUNT,
  InspectionDraft,
  WEAR_STEP,
  buildStepPatch,
  chunkWearTasks,
  damageToCreatePayload,
  damageToUpdatePayload,
  draftFromSheet,
  emptyDraft,
  groupFieldErrors,
  lastWearByTask,
  localDamageFromApi,
  localPlannedTaskFromApi,
  markStepSaved,
} from './inspectionStepperUtils'

const RESOURCE = 'garage/inspection'
const DAMAGES_STEP = 4
const PLANNED_STEP = INSPECTION_STEP_COUNT - 1

export type DamageChoice = 'none' | 'report' | null

/** Erreur « métier » levée localement (pas une réponse HTTP) : dégât sans description. */
class LocalValidationError extends Error {
  constructor(public readonly state: StepErrorState, public readonly damageIndex: number) {
    super(state.message)
  }
}

/**
 * Stepper de la fiche de contrôle. Les saisies vivent en état local, initialisé une seule fois (le PATCH invalide la fiche :
 * sans garde, la relecture écraserait la saisie en cours) ; elles sont écrites à chaque passage d'étape avec les seuls
 * champs modifiés. En ligne uniquement : un échec garde l'utilisateur sur l'étape, saisies intactes (story 3.2, D4).
 */
export function useInspectionStepper(sheetId: number, perPage: number) {
  const apiUrl = useApiUrl()
  const go = useGo()
  const invalidate = useInvalidate()
  const isOnline = useOnlineStatus()

  const { queryResult } = useShow<InspectionSheet>({ resource: RESOURCE, id: sheetId })
  const sheet = queryResult.data?.data
  const vehicle = sheet?.vehicle
  const { config, isError: configError, refetch: refetchConfig } = useGarageConfig()

  const { data: measurableData, isInitialLoading: measurableLoading, isError: measurableError } = useCustom<MeasurableTask[]>({
    url: `${apiUrl}/garage/inspection/measurable-tasks/`,
    method: 'get',
    config: { query: { vehicle: vehicle?.id } },
    queryOptions: { enabled: !!vehicle && sheet?.status === 'open' },
  })
  const measurableTasks = useMemo(() => measurableData?.data ?? [], [measurableData])

  const { data: catalogData, isError: catalogError, refetch: refetchCatalog } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: vehicle ? [{ field: 'vehicle_types', operator: 'eq', value: vehicle.type }] : [],
    pagination: { mode: 'off' },
    queryOptions: { enabled: !!vehicle },
  })
  const catalogById = useMemo(() => new Map((catalogData?.data ?? []).map((item) => [item.id, item])), [catalogData])

  // Dernier relevé d'usure : seulement pour la ligne de la carte « aérée » (une seule tâche) ; 403 ou erreur -> ligne omise.
  const { data: maintenanceData } = useOne<MaintenanceSummary>({
    resource: 'garage/maintenance',
    id: vehicle?.id,
    queryOptions: { enabled: !!vehicle && measurableTasks.length === 1, retry: false },
  })
  const lastWear = useMemo(() => lastWearByTask(maintenanceData?.data), [maintenanceData])

  // Relevé plus récent que la date du contrôle (retour de contrat entre-temps) : le relevé de la fiche ne mettra pas le véhicule à jour.
  const { data: latestMileageData } = useList<MileageEntry>({
    resource: `garage/mileage/${vehicle?.id}`,
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !!vehicle },
  })
  const latestMileageEntry = latestMileageData?.data[0]
  const moreRecentEntry =
    latestMileageEntry && sheet?.start_date && dayjs(latestMileageEntry.date).isAfter(sheet.start_date, 'day') ? latestMileageEntry : null

  const [draft, setDraft] = useState<InspectionDraft>(emptyDraft)
  const [saved, setSaved] = useState<InspectionDraft>(emptyDraft)
  const [damages, setDamagesState] = useState<LocalDamage[]>([])
  const [savedDamages, setSavedDamages] = useState<LocalDamage[]>([])
  const [damageChoice, setDamageChoice] = useState<DamageChoice>(null)
  const [invalidDamageIndex, setInvalidDamageIndex] = useState<number | null>(null)
  const [plannedTasks, setPlannedTasks] = useState<LocalTask[]>([])
  const [syncedPlanned, setSyncedPlanned] = useState<LocalTask[]>([])
  const [activeStep, setActiveStep] = useState(0)
  const [wearPage, setWearPage] = useState(0)
  const [resumedFromStep, setResumedFromStep] = useState<number | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [stepError, setStepError] = useState<StepErrorState | null>(null)
  const [expiredAfterError, setExpiredAfterError] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const initializedRef = useRef(false)
  const deletedDamageIdsRef = useRef<number[]>([])
  const busyRef = useRef(false)
  const lastMoveRef = useRef<'next' | 'back'>('next')

  const { viewStep, recapView, setRecapView } = useStepperView(activeStep, PLANNED_STEP)
  const pageCount = chunkWearTasks(measurableTasks, perPage).length
  // `perPage` varie avec le clavier et la rotation : la page courante est bornée à chaque rendu.
  const currentWearPage = Math.min(wearPage, Math.max(pageCount - 1, 0))

  // Initialisation unique une fois la fiche ET le catalogue chargés.
  useEffect(() => {
    if (!sheet || catalogData === undefined || initializedRef.current) return
    initializedRef.current = true
    const initial = draftFromSheet(sheet)
    setDraft(initial)
    setSaved(initial)
    const initialDamages = sheet.damages.map(localDamageFromApi)
    setDamagesState(initialDamages)
    setSavedDamages(initialDamages)
    setDamageChoice(initialDamages.length ? 'report' : null)
    const initialPlanned = sheet.tasks.map((task) => localPlannedTaskFromApi(task, catalogById))
    setPlannedTasks(initialPlanned)
    setSyncedPlanned(initialPlanned)
    const step = Math.min(Math.max(sheet.current_step ?? 1, 1), INSPECTION_STEP_COUNT) - 1
    setActiveStep(step)
    if (step > 0) setResumedFromStep(step + 1)
    setReady(true)
  }, [sheet, catalogData, catalogById])

  const { mutateAsync: customMutate, isLoading: isMutating } = useCustomMutation()
  const { mutateAsync: updateSheet } = useUpdate()

  const isExpired = !!sheet?.is_expired || expiredAfterError
  // Échec du chargement initial (fiche, catalogue, seuils) ou des tâches mesurables : sans cela le Loader tournerait indéfiniment.
  const loadFailed = (!ready && (queryResult.isError || catalogError || configError)) || (measurableError && !measurableData)
  const reload = () => {
    void queryResult.refetch()
    void refetchCatalog()
    void refetchConfig()
  }
  const saveState: SaveState = !isOnline ? 'offline' : saveFailed ? 'error' : 'saved'

  /** Toute 400 : la fiche a peut-être expiré en cours de saisie (le message générique ne le dit pas). */
  const checkExpiry = async (error: unknown) => {
    if (errorStatus(error) !== 400) return
    try {
      const refreshed = await queryResult.refetch()
      if (refreshed.data?.data.is_expired) setExpiredAfterError(true)
    } catch {
      // Relecture impossible (réseau) : le message de l'erreur d'origine reste affiché.
    }
  }

  /** `retryStep: false` : échec d'un ajout / retrait immédiat (étape 7) — le message s'affiche, mais « Réessayer » ne rejoue pas l'étape. */
  const handleError = async (error: unknown, retryStep = true) => {
    if (error instanceof LocalValidationError) {
      setStepError(error.state)
      setInvalidDamageIndex(error.damageIndex)
      setSaveFailed(true)
      return
    }
    if (!retryStep) {
      setStepError({ message: extractStepError(error), retryable: false, fields: [] })
      await checkExpiry(error)
      return
    }
    setStepError({
      message: extractStepError(error),
      retryable: isRetryableError(error),
      fields: groupFieldErrors(extractFieldErrors(error)),
    })
    setSaveFailed(true)
    await checkExpiry(error)
  }

  const request = (url: string, method: 'post' | 'patch' | 'delete', values: Record<string, unknown> = {}) =>
    customMutate({ url: `${apiUrl}/${RESOURCE}/${sheetId}/${url}`, method, values, successNotification: false, errorNotification: false })

  // ── Dégâts ────────────────────────────────────────────────────────────────

  const setDamages = (items: LocalDamage[]) => {
    setInvalidDamageIndex(null)
    damages
      .filter((damage) => damage.serverId != null && !items.some((item) => item.localId === damage.localId))
      .forEach((damage) => deletedDamageIdsRef.current.push(damage.serverId as number))
    setDamagesState(items)
  }

  const syncDamages = async () => {
    // Toutes les descriptions sont contrôlées avant le premier envoi.
    if (damageChoice !== 'none') {
      const missing = damages.findIndex((damage) => !damage.description.trim())
      if (missing >= 0) {
        throw new LocalValidationError(
          { message: `Dégât ${missing + 1} : description manquante`, retryable: false, fields: [{ field: 'damages', label: `Dégât ${missing + 1}`, message: 'description manquante', step: DAMAGES_STEP }] },
          missing,
        )
      }
    }
    const toDelete = damageChoice === 'none' ? damages.filter((d) => d.serverId != null).map((d) => d.serverId as number) : []
    const ids = [...deletedDamageIdsRef.current, ...toDelete]
    for (const id of ids) {
      await request(`damages/${id}/`, 'delete')
      deletedDamageIdsRef.current = deletedDamageIdsRef.current.filter((pending) => pending !== id)
      // « Aucun dégât » : un échec en cours de boucle ne doit jamais faire rejouer un DELETE déjà passé (404).
      if (toDelete.includes(id)) {
        setDamagesState((prev) => prev.filter((item) => item.serverId !== id))
        setSavedDamages((prev) => prev.filter((item) => item.serverId !== id))
      }
    }
    if (damageChoice === 'none') {
      setDamagesState([])
      setSavedDamages([])
      return
    }
    // Chaque réussite est conservée tout de suite : un échec en cours de boucle ne doit jamais faire renvoyer un dégât déjà créé.
    const commit = (rebuilt: LocalDamage) => {
      setDamagesState((prev) => prev.map((item) => (item.localId === rebuilt.localId ? rebuilt : item)))
      setSavedDamages((prev) => (prev.some((item) => item.localId === rebuilt.localId) ? prev.map((item) => (item.localId === rebuilt.localId ? rebuilt : item)) : [...prev, rebuilt]))
    }
    for (const damage of damages) {
      if (!damage.serverId) {
        const response = await request('damages/', 'post', damageToCreatePayload(damage))
        commit({ ...localDamageFromApi(response.data as never), localId: damage.localId })
        continue
      }
      const previous = savedDamages.find((item) => item.localId === damage.localId)
      const payload = previous ? damageToUpdatePayload(damage, previous) : {}
      if (Object.keys(payload).length === 0) continue
      const response = await request(`damages/${damage.serverId}/`, 'patch', payload)
      commit({ ...localDamageFromApi(response.data as never), localId: damage.localId })
    }
  }

  // ── Opérations à prévoir ──────────────────────────────────────────────────

  const addPlanned = async (picked: LocalTask) => {
    if (busyRef.current) return
    busyRef.current = true
    setIsBusy(true)
    setStepError(null)
    try {
      const response = await request('tasks/', 'post', picked.catalogTaskId ? { catalog_task: picked.catalogTaskId } : { name: picked.name })
      const rebuilt = localPlannedTaskFromApi(response.data as never, catalogById)
      setPlannedTasks((prev) => [rebuilt, ...prev])
      setSyncedPlanned((prev) => [rebuilt, ...prev])
    } catch (error) {
      await handleError(error, false)
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }

  const updatePlanned = (task: LocalTask) => setPlannedTasks((prev) => prev.map((item) => (item.localId === task.localId ? task : item)))

  const removePlanned = async (localId: string) => {
    if (busyRef.current) return
    const task = plannedTasks.find((item) => item.localId === localId)
    if (!task) return
    busyRef.current = true
    setIsBusy(true)
    setStepError(null)
    try {
      if (task.serverId) await request(`tasks/${task.serverId}/`, 'delete')
      setPlannedTasks((prev) => prev.filter((item) => item.localId !== localId))
      setSyncedPlanned((prev) => prev.filter((item) => item.localId !== localId))
    } catch (error) {
      await handleError(error, false)
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }

  const syncPlanned = async () => {
    const syncedById = new Map(syncedPlanned.map((task) => [task.localId, task]))
    for (const task of plannedTasks) {
      const previous = syncedById.get(task.localId)
      if (!task.serverId || !previous) continue
      const payload = localTaskToUpdatePayload(task, previous)
      if (Object.keys(payload).length === 0) continue
      const response = await request(`tasks/${task.serverId}/`, 'patch', payload)
      const rebuilt = { ...localPlannedTaskFromApi(response.data as never, catalogById), localId: task.localId }
      setPlannedTasks((prev) => prev.map((item) => (item.localId === task.localId ? rebuilt : item)))
      setSyncedPlanned((prev) => prev.map((item) => (item.localId === task.localId ? rebuilt : item)))
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Écrit l'étape quittée puis déplace le curseur ; en cas d'échec, reste sur l'étape et garde les saisies. */
  const transition = async (target: number, onSuccess: () => void, syncDamagesOnLeave = true) => {
    if (busyRef.current) return
    busyRef.current = true
    setIsBusy(true)
    setStepError(null)
    setInvalidDamageIndex(null)
    try {
      if (activeStep === DAMAGES_STEP && syncDamagesOnLeave) await syncDamages()
      if (activeStep === PLANNED_STEP) await syncPlanned()
      await updateSheet({
        resource: RESOURCE,
        id: sheetId,
        values: buildStepPatch(activeStep, target, draft, saved),
        successNotification: false,
        errorNotification: false,
        invalidates: [],
      })
      setSaved((current) => markStepSaved(activeStep, draft, current))
      setSaveFailed(false)
      onSuccess()
    } catch (error) {
      await handleError(error)
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }

  const goNext = async () => {
    lastMoveRef.current = 'next'
    if (activeStep === WEAR_STEP && currentWearPage < pageCount - 1) {
      setWearPage(currentWearPage + 1)
      return
    }
    if (activeStep === PLANNED_STEP) {
      await transition(PLANNED_STEP, () => setRecapView(true))
      return
    }
    await transition(activeStep + 1, () => {
      setActiveStep(activeStep + 1)
      setWearPage(0)
    })
  }

  const goBack = async () => {
    lastMoveRef.current = 'back'
    if (recapView) {
      setRecapView(false)
      return
    }
    if (activeStep === WEAR_STEP && currentWearPage > 0) {
      setWearPage(currentWearPage - 1)
      return
    }
    if (activeStep === 0) return
    const target = activeStep - 1
    await transition(target, () => {
      setActiveStep(target)
      setWearPage(target === WEAR_STEP ? Math.max(0, pageCount - 1) : 0)
    }, false)
  }

  /** « Réessayer » rejoue le dernier déplacement tenté, avant ou arrière. */
  const retry = () => (lastMoveRef.current === 'back' ? goBack() : goNext())

  /** Saut vers une étape à corriger (lien « Corriger › » de l'alerte d'erreur) : sans écriture, l'erreur est levée. */
  const jumpToStep = (step: number) => {
    setStepError(null)
    setSaveFailed(false)
    setInvalidDamageIndex(null)
    setRecapView(false)
    setActiveStep(step)
    setWearPage(0)
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const validateSheet = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setIsBusy(true)
    setStepError(null)
    try {
      const { data } = await request('validate/', 'post')
      const result = data as ValidateInspectionResponse
      invalidate({ resource: RESOURCE, id: sheetId, invalidates: ['list', 'detail'] })
      if (vehicle) {
        invalidate({ resource: 'vehicle', id: vehicle.id, invalidates: ['detail'] })
        invalidate({ resource: 'garage/maintenance', id: vehicle.id, invalidates: ['detail'] })
      }
      const warning = result?.warnings?.[0]
      if (warning) {
        showNotification({ color: 'orange', title: 'Kilométrage du véhicule non mis à jour', message: warning.message, autoClose: false })
      }
      setSaveFailed(false)
      setIsDone(true)
    } catch (error) {
      await handleError(error)
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }

  const goHome = () => go({ to: '/garage' })

  return {
    sheet,
    vehicle,
    isLoading: (queryResult.isLoading || !ready || !config || measurableLoading) && !loadFailed,
    loadFailed,
    reload,
    isExpired,
    isDone,
    config,
    measurableTasks,
    lastWear,
    moreRecentEntry,
    draft,
    setDraft,
    damages,
    setDamages,
    damageChoice,
    setDamageChoice,
    invalidDamageIndex,
    plannedTasks,
    addPlanned,
    updatePlanned,
    removePlanned,
    activeStep,
    viewStep,
    recapView,
    wearPage: currentWearPage,
    pageCount,
    resumedFromStep,
    saveState,
    stepError,
    isBusy: isBusy || isMutating,
    isOnline,
    goNext,
    goBack,
    retry,
    jumpToStep,
    validateSheet,
    goHome,
  }
}
