import { SegmentedControl, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { showNotification } from '@mantine/notifications'
import { useWearInput } from '../../hooks/garage/useWearInput'
import { WearInput } from './WearTaskCard'

const OPTIONS = [
  { value: 'segments', label: 'Boutons' },
  { value: 'slider', label: 'Curseur' },
]

/** Réglage du compte : saisie de l'usure dans la fiche de contrôle (curseur par défaut, ou boutons). */
export default function WearInputSetting() {
  const { value, setValue } = useWearInput()
  const [pending, setPending] = useState(false)

  const onChange = async (next: string) => {
    setPending(true)
    try {
      await setValue(next as WearInput)
    } catch {
      showNotification({ color: 'red', message: "Le réglage n'a pas pu être enregistré." })
    } finally {
      setPending(false)
    }
  }

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">Saisie de l&apos;usure</Text>
      <SegmentedControl fullWidth size="md" data={OPTIONS} value={value} onChange={onChange} disabled={pending} />
    </Stack>
  )
}
