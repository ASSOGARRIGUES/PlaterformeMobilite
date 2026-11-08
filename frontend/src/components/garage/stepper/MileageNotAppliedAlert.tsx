import { Alert } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { humanizeDate, humanizeNumber } from '../../../constants'
import { MileageEntry } from '../../../types/garage'

type MileageNotAppliedAlertProps = {
  /** Relevé du véhicule postérieur à la date de début de la fiche. */
  moreRecentEntry: MileageEntry
}

/** Prévient, avant validation, que le relevé de la fiche ne mettra pas à jour le kilométrage du véhicule. */
export function MileageNotAppliedAlert({ moreRecentEntry }: MileageNotAppliedAlertProps) {
  return (
    <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Le kilométrage du véhicule ne sera pas mis à jour">
      Un relevé plus récent existe ({humanizeNumber(moreRecentEntry.value)} km au {humanizeDate(moreRecentEntry.date)}).
      Le kilométrage de cette fiche sera ajouté à l&apos;historique. Si l&apos;une des deux valeurs est erronée,
      corrigez-la depuis l&apos;historique kilométrique du véhicule.
    </Alert>
  )
}
