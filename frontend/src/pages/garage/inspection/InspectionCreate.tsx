import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCreate, useDelete, useGetIdentity, useGo, useList } from '@refinedev/core'
import { ActionIcon, Alert, Button, Center, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconWifiOff } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import VehicleSelect from '../../../components/Vehicle/VehicleSelect'
import { ResumeSheetModal } from '../../../components/garage/inspection/ResumeSheetModal'
import { INSPECTION_STEP_LABELS } from '../../../hooks/garage/inspectionStepperUtils'
import { useOnlineStatus } from '../../../hooks/garage/useOnlineStatus'
import { InspectionSheet } from '../../../types/garage'
import { WhoAmI } from '../../../types/auth'

dayjs.extend(relativeTime)
dayjs.locale('fr')

const RESOURCE = 'garage/inspection'
const CREATE_ERROR = 'Impossible de créer la fiche de contrôle. Réessayez.'

/** « Arrêtée à l'étape 4 · Éclairage » */
const stoppedAtLabel = (currentStep: number | undefined) => {
  const step = Math.min(Math.max(currentStep ?? 1, 1), INSPECTION_STEP_LABELS.length)
  return `Arrêtée à l'étape ${step} · ${INSPECTION_STEP_LABELS[step - 1]}`
}

const InspectionCreate = () => {
  const [searchParams] = useSearchParams()
  const vehicleParam = searchParams.get('vehicle')
  const go = useGo()
  const isOnline = useOnlineStatus()
  const { data: identity } = useGetIdentity<WhoAmI>()
  const { mutateAsync: create } = useCreate()
  const { mutateAsync: remove } = useDelete()
  const creatingRef = useRef(false)
  const lastVehicleRef = useRef<number | null>(null)
  const [conflictVehicle, setConflictVehicle] = useState<number | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  // true une fois la question « fiche déjà en cours » réglée (aucune fiche, ou abandon confirmé)
  const [resumeSettled, setResumeSettled] = useState(false)
  const [isAbandoning, setIsAbandoning] = useState(false)

  // Fiche ouverte non expirée de l'utilisateur (la liste masque déjà les fiches expirées)
  const { data: mineData, isFetched: mineFetched } = useList<InspectionSheet>({
    resource: RESOURCE,
    filters: [
      { field: 'status', operator: 'eq', value: 'open' },
      { field: 'created_by', operator: 'eq', value: identity?.id },
    ],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: identity?.id != null },
  })
  const mine = mineData?.data?.[0]

  useEffect(() => {
    if (mineFetched && !mine) setResumeSettled(true)
  }, [mineFetched, mine])

  const doCreate = async (vehicleId: number) => {
    if (creatingRef.current) return
    creatingRef.current = true
    lastVehicleRef.current = vehicleId
    setCreateError(null)
    try {
      const response = await create({
        resource: RESOURCE,
        values: { vehicle: vehicleId },
        successNotification: false,
        errorNotification: false,
      })
      go({ to: `/garage/inspection/${response.data.id}` })
    } catch (error) {
      creatingRef.current = false
      // 400 = une fiche est déjà ouverte sur ce véhicule (par véhicule, quel qu'en soit l'auteur) -> on l'ouvre
      const statusCode = (error as { statusCode?: number })?.statusCode
      if (statusCode === 400) setConflictVehicle(vehicleId)
      else if (statusCode === 403) setCreateError("Vous n'avez pas la permission de créer une fiche de contrôle.")
      else setCreateError(CREATE_ERROR)
    }
  }

  // Création automatique quand le véhicule est présélectionné (?vehicle=<id>), après réglage de la fiche en cours
  useEffect(() => {
    if (vehicleParam && resumeSettled && isOnline && !creatingRef.current) void doCreate(Number(vehicleParam))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleParam, resumeSettled, isOnline])

  const { data: conflictData, isFetched: conflictFetched } = useList<InspectionSheet>({
    resource: RESOURCE,
    filters: [
      { field: 'vehicle', operator: 'eq', value: conflictVehicle },
      { field: 'status', operator: 'eq', value: 'open' },
    ],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: conflictVehicle != null },
  })
  useEffect(() => {
    if (conflictVehicle == null || !conflictFetched) return
    const existing = conflictData?.data?.[0]
    if (existing) go({ to: `/garage/inspection/${existing.id}` })
    else setCreateError(CREATE_ERROR)
  }, [conflictVehicle, conflictData, conflictFetched, go])

  // « Réessayer » : rejoue la création, ou revient au modal de reprise si c'est l'abandon qui a échoué.
  const retry = () => {
    setCreateError(null)
    setConflictVehicle(null)
    if (lastVehicleRef.current != null && !mine) void doCreate(lastVehicleRef.current)
  }

  const abandon = async () => {
    if (!mine) return
    setIsAbandoning(true)
    try {
      await remove({ resource: RESOURCE, id: mine.id, successNotification: false, errorNotification: false })
      setResumeSettled(true)
    } catch {
      setCreateError("Impossible d'abandonner la fiche en cours. Réessayez.")
    } finally {
      setIsAbandoning(false)
    }
  }

  const header = (
    <Group gap="xs">
      <ActionIcon variant="subtle" onClick={() => go({ to: '/garage' })} aria-label="Retour">
        <IconArrowLeft size={20} />
      </ActionIcon>
      <Title order={3}>Nouveau contrôle</Title>
    </Group>
  )

  if (!isOnline) {
    return (
      <Stack p="md" maw={480}>
        {header}
        <Alert color="orange" icon={<IconWifiOff size={18} />}>
          Hors ligne : un nouveau contrôle ne peut pas être créé tant que la connexion n&apos;est pas revenue.
        </Alert>
      </Stack>
    )
  }

  if (createError) {
    return (
      <Stack p="md" maw={480}>
        {header}
        <Text c="red">{createError}</Text>
        <Button mih={48} onClick={retry}>Réessayer</Button>
      </Stack>
    )
  }

  if (mine && !resumeSettled) {
    return (
      <>
        <Center h="60vh"><Loader /></Center>
        <ResumeSheetModal
          opened
          imat={mine.vehicle.imat}
          since={dayjs(mine.created_at).fromNow()}
          stoppedAt={stoppedAtLabel(mine.current_step)}
          isAbandoning={isAbandoning}
          onContinue={() => go({ to: `/garage/inspection/${mine.id}` })}
          onAbandon={() => void abandon()}
          onClose={() => go({ to: '/garage' })}
        />
      </>
    )
  }

  if (!vehicleParam && resumeSettled) {
    return (
      <Stack p="md" maw={480}>
        {header}
        <VehicleSelect
          onChange={(value) => {
            if (value) void doCreate(Number(value))
          }}
        />
      </Stack>
    )
  }

  return (
    <Center h="60vh">
      <Loader />
    </Center>
  )
}

export default InspectionCreate
