import { List } from '@refinedev/mantine'
import { useMemo } from 'react'
import { useGo } from '@refinedev/core'
import { DataTableRowClickHandler } from 'mantine-datatable'
import VehicleBadge from '../../../components/Vehicle/VehicleBadge'
import { InterventionStatusBadge } from '../../../components/garage/intervention/InterventionStatusBadge'
import InterventionStatusFilter from '../../../components/garage/intervention/filters/InterventionStatusFilter'
import InterventionDateFilter from '../../../components/garage/intervention/filters/InterventionDateFilter'
import SearchableDataTable, { SearchableDataTableColumn } from '../../../components/SearchableDataTable'
import { InterventionSheet } from '../../../types/garage'
import { Vehicle } from '../../../types/vehicle'
import { humanizeDate, humanizeFirstName, humanizeNumber } from '../../../constants'

const InterventionList = () => {
  const go = useGo()

  const columns = useMemo<SearchableDataTableColumn<InterventionSheet>[]>(
    () => [
      {
        accessor: 'vehicle',
        title: 'Véhicule',
        sortable: true,
        render: (sheet) => <VehicleBadge vehicle={sheet.vehicle as Vehicle} noLink />,
      },
      {
        accessor: 'status',
        title: 'Statut',
        sortable: true,
        textAlignment: 'center',
        render: (sheet) => <InterventionStatusBadge status={sheet.status} />,
        filter: InterventionStatusFilter,
      },
      {
        accessor: 'created_at',
        title: 'Date',
        sortable: true,
        render: (sheet) => humanizeDate(sheet.created_at),
        filter: InterventionDateFilter,
      },
      {
        accessor: 'start_mileage',
        title: 'Kilométrage',
        render: (sheet) => (sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—'),
      },
      {
        accessor: 'created_by',
        title: 'Garagiste',
        render: (sheet) =>
          sheet.created_by ? `${humanizeFirstName(sheet.created_by.first_name)} ${sheet.created_by.last_name}` : '—',
      },
    ],
    [],
  )

  const rowClickHandler: DataTableRowClickHandler<InterventionSheet> = ({ record }) => {
    go({ to: `/garage/intervention/${record.id}` })
  }

  return (
    <List title="Interventions" canCreate={false}>
      <SearchableDataTable
        resource="garage/intervention"
        searchPlaceHolder="Rechercher une intervention (véhicule, garagiste)"
        columns={columns}
        withReloadIcon
        withArchivedSwitch={false}
        withAddIcon
        addPermKey="garage.manage_intervention"
        addCallback={() => go({ to: '/garage/intervention/create' })}
        /*@ts-ignore*/
        verticalSpacing="md"
        defaultSortedColumn="created_at"
        defaultSortedDirection="desc"
        onRowClick={rowClickHandler}
      />
    </List>
  )
}

export default InterventionList
