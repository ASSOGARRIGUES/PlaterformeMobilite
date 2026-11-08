import { NumberInput, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { components } from '../../../types/schema'
import { humanizeNumber } from '../../../constants'
import { MileageEntry } from '../../../types/garage'
import { MileageNotAppliedAlert } from './MileageNotAppliedAlert'

type Vehicle = components['schemas']['Vehicle']

type StepMileageProps = {
  vehicle: Vehicle
  value: number | ''
  onChange: (value: number | '') => void
  startDate: Date | null
  onStartDate: (value: Date | null) => void
  moreRecentEntry: MileageEntry | null
  /** Fiche de contrôle : datée du jour, pas de sélecteur de date. */
  hideDate?: boolean
  /** Touche d'action du clavier mobile (flèche) : ferme le clavier puis appelle `onSubmit`. */
  onSubmit?: () => void
}

export function StepMileage({ vehicle, value, onChange, startDate, onStartDate, moreRecentEntry, hideDate = false, onSubmit }: StepMileageProps) {
  return (
    <Stack gap="md">
      {!hideDate && (
        <DatePickerInput
          label="Date de l'intervention"
          description="Utilisée pour comparer le kilométrage saisi à l'historique du véhicule à cette date."
          required
          valueFormat="DD/MM/YYYY"
          value={startDate}
          onChange={onStartDate}
          maxDate={new Date()}
        />
      )}
      <Text c="dimmed" size="sm">
        Dernier kilométrage connu : <b>{humanizeNumber(vehicle.kilometer)} km</b>
      </Text>
      <NumberInput
        label="Kilométrage à l'entrée"
        value={value}
        onChange={(v) => onChange(v === '' ? '' : Number(v))}
        min={0}
        thousandSeparator=" "
        enterKeyHint={onSubmit ? 'next' : undefined}
        onKeyDown={(event) => {
          if (!onSubmit || event.key !== 'Enter') return
          event.preventDefault()
          event.currentTarget.blur()
          onSubmit()
        }}
        description={
          value !== '' && value < vehicle.kilometer
            ? `Inférieur au dernier relevé (${humanizeNumber(vehicle.kilometer)} km) : accepté seulement si cohérent avec l'historique du véhicule ${hideDate ? 'à la date du contrôle' : 'à la date ci-dessus'}, sinon une erreur apparaîtra en poursuivant.`
            : undefined
        }
      />
      {moreRecentEntry && <MileageNotAppliedAlert moreRecentEntry={moreRecentEntry} />}
    </Stack>
  )
}
