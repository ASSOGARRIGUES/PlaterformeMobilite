import { MultiSelect } from '@mantine/core'
import { ColumnFilter } from '../../../SearchableDataTable'
import { InterventionSheet } from '../../../../types/garage'
import { InterventionSheetStatusEnum } from '../../../../types/schema.d'

const STATUS_LABELS: Record<string, string> = {
  [InterventionSheetStatusEnum.open]: 'Ouverte',
  [InterventionSheetStatusEnum.validated]: 'Validée',
}

const InterventionStatusFilter: ColumnFilter<InterventionSheet> = (accessor, value, setValue) => {
  const fieldValues = value?.[0]?.value

  const statusData = Object.values(InterventionSheetStatusEnum).map((status) => ({
    value: status,
    label: STATUS_LABELS[status] ?? status,
  }))

  return (
    <MultiSelect
      label="Statut"
      description="Filtrer par statut"
      data={statusData}
      value={fieldValues}
      placeholder="Choisir un ou plusieurs statuts"
      onChange={(values) => setValue([{ value: values, field: accessor, operator: 'in' }])}
      clearable
      comboboxProps={{ withinPortal: false }}
      w={250}
    />
  )
}

export default InterventionStatusFilter
