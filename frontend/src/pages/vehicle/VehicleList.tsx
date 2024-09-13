import {List} from "@refinedev/mantine";
import { Group} from "@mantine/core";
import {useMemo} from "react";
import SearchableDataTable, {SearchableDataTableColumn} from "../../components/SearchableDataTable";
import {Vehicle} from "../../types/vehicle";
import {FuelTypeEnum, TransmissionEnum} from "../../types/schema.d";
import VehicleModal from "../../components/Vehicle/VehicleModal";
import TransmissionIcon from "../../components/Vehicle/TransmissionIcon";
import FuelIcon from "../../components/Vehicle/FuelIcon";
import {useGetToPath, useGo} from "@refinedev/core";
import useVehicleModalForm from "../../hooks/vehicle/useVehicleModalForm";
import EditButton from "../../components/EditButton";
import VehicleStatusBadge from "../../components/Vehicle/VehicleStatusBadge";
import VehicleSearchTooltip from "../../components/Vehicle/VehicleSearchTooltip";
import VehicleAvatar from "../../components/Vehicle/VehicleAvatar";
import {DataTableRowClickHandler} from "mantine-datatable";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import {useMantineTheme} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import VehicleStatusFilter from "../../components/Vehicle/filters/VehicleStatusFilter";
import VehicleTypeFilter from "../../components/Vehicle/filters/VehicleTypeFilter";


const VehicleList = () => {

    const theme = useMantineTheme();
    const smallerThanMd = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);

    const go = useGo();
    const getToPath = useGetToPath();

    const createModalForm = useVehicleModalForm({action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    const editModalForm = useVehicleModalForm({action: "edit"});
    const {modal: { show: showEditModal},  getInputProps} = editModalForm;

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
                accessor: "actions",
                title:"Actions",
                textAlign: "center",
                render: (car) => (<EditButton record={car} showEditModal={showEditModal}/>),
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            }
        ],
        [],
    );

    const rowClickHandler: DataTableRowClickHandler<Vehicle> = ({record : vehicle, index, event}) => {
        const path = getToPath({
            action: "show",
            meta: {
                id: vehicle.id
            }
        });

        go({
            to: path
        });
    }


    return (
        <>
            <VehicleModal {...createModalForm}/>
            <VehicleModal {...editModalForm}/>

            <List title="" wrapperProps={{children: undefined, style:{height:(smallerThanMd ? "100vh" : "100%"), display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <SearchableDataTable
                    searchPlaceHolder={"Rechercher un véhicule"}
                    columns={columns}

                    withAddIcon={true}
                    addCallback={() => {showCreateModal()}}
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

export default VehicleList;