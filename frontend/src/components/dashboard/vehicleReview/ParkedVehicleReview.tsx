import {Vehicle} from "../../../types/vehicle";
import {Group} from "@mantine/core";
import TransmissionIcon from "../../Vehicle/TransmissionIcon";
import {FuelTypeEnum, TransmissionEnum, VehicleStatusEnum} from "../../../types/schema.d";
import FuelIcon from "../../Vehicle/FuelIcon";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable";
import VehicleAvatar from "../../Vehicle/VehicleAvatar";
import VehicleStatusBadge from "../../Vehicle/VehicleStatusBadge";
import {Beneficiary} from "../../../types/beneficiary";
import {List} from "@refinedev/mantine";
import SearchableDataTable from "../../SearchableDataTable";
import VehicleSearchTooltip from "../../Vehicle/VehicleSearchTooltip";
import {useGetToPath, useGo} from "@refinedev/core";
import ParkingChangeSelect from "../../Vehicle/ParkingChangeSelect";
import QuickStatusButton from "../../Vehicle/QuickStatusButton";

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

    const columns = useMemo<DataTableColumn<Vehicle>[]>(
        () => [
            {
                accessor: 'fleet_id', //access nested data with dot notation
                title: 'ID',
                sortable: true,
                width:80,
            },
            {
                accessor: 'photo',
                title: 'Photo',
                render: (vehicle) => (<VehicleAvatar vehicle={vehicle} size={40}/>),
                width: 60,
                cellsStyle: {paddingTop: 0, paddingBottom: 0}
            },
            {
                accessor: 'type-icon',
                title: 'Type',
                render: (car) => (<VehicleCaracteristics car={car}/>),
            },
            {
                accessor: 'brand',
                title: 'Marque',
                sortable: true,
            },
            {
                accessor: 'modele', //normal accessorKey
                title: 'Modèle',
                sortable: true,
            },
            {
                accessor: 'imat',
                title: 'IMMAT',
                sortable: true,
            },
            {
                accessor: 'status',
                title: 'Statut',
                sortable: true,
                render:(vehicle) => (<VehicleStatusBadge vehicle={vehicle}/>)
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
                render: (vehicle) => (<ParkingChangeSelect withLabel={false} vehicle={vehicle}/>),
            },
        ],
        [],
    );

    const rowClickHandler = (beneficiary: Beneficiary, rowIndex: number) => {
        const path = getToPath({
            action: "show",
            meta: {
                id: beneficiary.id
            }
        });

        go({
            to: path
        });
    }

    return (
        <>

            <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <SearchableDataTable
                    searchPlaceHolder={"Rechercher un véhicule"}
                    columns={columns}
                    resource="vehicle"
                    defaultFilters={[{field:"status", operator:"in", value: [VehicleStatusEnum.available, VehicleStatusEnum.maintenance]}]}

                    withReloadIcon
                    /*@ts-ignore*/
                    verticalSpacing="md"
                    onRowClick={rowClickHandler}
                    searchInfoTooltip={VehicleSearchTooltip}
                />
            </List>
        </>
    )
}

export default ParkedVehicleReview