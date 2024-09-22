import {Vehicle} from "../../../types/vehicle";
import {Group} from "@mantine/core";
import TransmissionIcon from "../../Vehicle/TransmissionIcon";
import {FuelTypeEnum, TransmissionEnum, VehicleStatusEnum} from "../../../types/schema.d";
import FuelIcon from "../../Vehicle/FuelIcon";
import {useMemo} from "react";
import VehicleAvatar from "../../Vehicle/VehicleAvatar";
import VehicleStatusBadge from "../../Vehicle/VehicleStatusBadge";
import {Beneficiary} from "../../../types/beneficiary";
import {List} from "@refinedev/mantine";
import SearchableDataTable, {SearchableDataTableColumn} from "../../SearchableDataTable";
import VehicleSearchTooltip from "../../Vehicle/VehicleSearchTooltip";
import {useGetToPath, useGo} from "@refinedev/core";
import ParkingChangeSelect from "../../Vehicle/ParkingChangeSelect";
import QuickStatusButton from "../../Vehicle/QuickStatusButton";
import VehicleBadge from "../../Vehicle/VehicleBadge";
import VehicleTypeFilter from "../../Vehicle/filters/VehicleTypeFilter";
import VehicleStatusFilter from "../../Vehicle/filters/VehicleStatusFilter";
import {DataTableCellClickHandler, DataTableRowClickHandler} from "mantine-datatable";

const ParkedVehicleReview = ({})=>{

    const go = useGo();
    const getToPath = useGetToPath();

    const VehicleCaracteristics = ({car}: {car: Vehicle}) => {
        return (
            <Group>
                <TransmissionIcon transmission={car.transmission as TransmissionEnum}/>
                <FuelIcon fuel={car.fuel_type as FuelTypeEnum}/>
            </Group>
        )
    }

    const columns = useMemo<SearchableDataTableColumn<Vehicle>[]>(
        () => [
              {
                accessor: 'fleet_id', //access nested data with dot notation
                title: 'ID',
                sortable: true,
                width:80,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'mobile-badge',
                title: "ID",
                render: (vehicle) => (<VehicleBadge vehicle={vehicle} noLink noColor/>),
                visibleMediaQuery: (theme) => `(max-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'photo',
                title: 'Photo',
                render: (vehicle) => (<VehicleAvatar vehicle={vehicle} size={40}/>),
                width: 60,
                cellsStyle: ()=>({paddingTop: 0, paddingBottom: 0})
            },
            {
                accessor: 'type-icon',
                title: 'Type',
                render: (car) => (<VehicleCaracteristics car={car}/>),
                filter: VehicleTypeFilter,
                filteredKeys: ["fuel_type", "transmission"],
            },
            {
                accessor: 'brand',
                title: 'Marque',
                sortable: true,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'modele', //normal accessorKey
                title: 'Modèle',
                sortable: true,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'imat',
                title: 'IMMAT',
                sortable: true,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'status',
                title: 'Statut',
                sortable: true,
                render:(vehicle) => (<VehicleStatusBadge vehicle={vehicle}/>),
                filter: VehicleStatusFilter
            },
            {
                accessor: "action",
                title:"Action",
                textAlignment:"center",
                render: (vehicle) => (<QuickStatusButton vehicle={vehicle}/>),
            },
            {
                accessor: "parking",
                title:"Parking",
                width:150,
                render: (vehicle) => (<ParkingChangeSelect withLabel={false} vehicle={vehicle} onClick={(e) => e.stopPropagation()}/>),
            },
        ],
        [],
    );

    const rowClickHandler: DataTableRowClickHandler<Vehicle> = ({record : vehicle, index, event}) => {
        go({
            to: {
                resource: "vehicle",
                action: "show",
                id: vehicle.id
            }
        });
    }

    const cellClickHandler: DataTableCellClickHandler<Vehicle> = ({record: vehicle, index, column, event}) => {
        if(column.accessor === "parking"){
            event.stopPropagation();
            return;
        }
        rowClickHandler({record: vehicle, index, event});
    }

    return (
        <>

            <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <SearchableDataTable
                    searchPlaceHolder={"Rechercher un véhicule"}
                    columns={columns}
                    resource="vehicle"
                    permanentFilters={[{field:"status", operator:"in", value: [VehicleStatusEnum.available, VehicleStatusEnum.maintenance]}]}

                    withReloadIcon
                    withArchivedSwitch={false}
                    /*@ts-ignore*/
                    verticalSpacing="md"
                    // onRowClick={rowClickHandler}
                    onCellClick={cellClickHandler}
                    searchInfoTooltip={VehicleSearchTooltip}
                />
            </List>
        </>
    )
}

export default ParkedVehicleReview