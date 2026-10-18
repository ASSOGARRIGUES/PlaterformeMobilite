import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCreate, useList, useGo, useBack } from '@refinedev/core'
import { ActionIcon, Center, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import VehicleSelect from '../../../components/Vehicle/VehicleSelect'
import { CreateInterventionPayload, InterventionSheet } from '../../../types/garage'

const InterventionCreate = () => {
  const [searchParams] = useSearchParams()
  const vehicleParam = searchParams.get('vehicle')
  const go = useGo()
  const back = useBack()
  const { mutateAsync: create } = useCreate()
  const createdRef = useRef(false)
  const [conflictVehicle, setConflictVehicle] = useState<number | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const doCreate = async (vehicleId: number) => {
    setCreateError(null)
    try {
      const response = await create({
        resource: 'garage/intervention',
        values: { vehicle: vehicleId } as CreateInterventionPayload,
        successNotification: false,
        errorNotification: false,
      })
      go({ to: `/garage/intervention/${response.data.id}` })
    } catch (error) {
      // 400 = une fiche est déjà ouverte pour ce véhicule (AC8) → on reprend l'existante
      const statusCode = (error as { statusCode?: number })?.statusCode
      if (statusCode === 400) {
        setConflictVehicle(vehicleId)
      } else {
        setCreateError("Impossible de créer la fiche d'intervention. Réessayez.")
      }
    }
  }

  // Création automatique quand le véhicule est présélectionné (?vehicle=<id>)
  useEffect(() => {
    if (vehicleParam && !createdRef.current) {
      createdRef.current = true
      void doCreate(Number(vehicleParam))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleParam])

  // Reprise de la fiche ouverte existante en cas de conflit (AC8)
  const { data: openSheets, isFetched: openSheetsFetched } = useList<InterventionSheet>({
    resource: 'garage/intervention',
    filters: [
      { field: 'vehicle', operator: 'eq', value: conflictVehicle },
      { field: 'status', operator: 'eq', value: 'open' },
    ],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: conflictVehicle != null },
  })
  useEffect(() => {
    if (!openSheetsFetched) return
    const existing = openSheets?.data?.[0]
    if (existing) {
      go({ to: `/garage/intervention/${existing.id}` })
    } else {
      setCreateError("Impossible de créer la fiche d'intervention. Réessayez.")
    }
  }, [openSheets, openSheetsFetched, go])

  if (createError) {
    return (
      <Stack p="md" maw={480}>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={back} aria-label="Retour">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={3}>Nouvelle intervention</Title>
        </Group>
        <Text c="red">{createError}</Text>
      </Stack>
    )
  }

  if (!vehicleParam) {
    return (
      <Stack p="md" maw={480}>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={back} aria-label="Retour">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={3}>Nouvelle intervention</Title>
        </Group>
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

export default InterventionCreate
