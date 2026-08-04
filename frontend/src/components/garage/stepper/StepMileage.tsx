import { NumberInput, Stack, Text } from '@mantine/core'
import { components } from '../../../types/schema'
import { humanizeNumber } from '../../../constants'

type Vehicle = components['schemas']['Vehicle']

type StepMileageProps = {
  vehicle: Vehicle
  value: number | ''
  onChange: (value: number | '') => void
}

export function StepMileage({ vehicle, value, onChange }: StepMileageProps) {
  return (
    <Stack gap="md">
      <Text c="dimmed" size="sm">
        Dernier kilométrage connu : <b>{humanizeNumber(vehicle.kilometer)} km</b>
      </Text>
      <NumberInput
        label="Kilométrage à l'entrée"
        value={value}
        onChange={(v) => onChange(v === '' ? '' : Number(v))}
        min={vehicle.kilometer}
        thousandSeparator=" "
        error={
          value !== '' && value < vehicle.kilometer
            ? `Inférieur au dernier relevé (${humanizeNumber(vehicle.kilometer)} km). Faites d'abord une correction kilométrique depuis la fiche véhicule (onglet "Historique kilométrique") avant de démarrer l'intervention.`
            : undefined
        }
      />
    </Stack>
  )
}
