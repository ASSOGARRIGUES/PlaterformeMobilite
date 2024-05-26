import {List, useModalForm} from "@refinedev/mantine";
import {ActionIcon, Center, Group} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import SearchableDataTable from "../../components/SearchableDataTable";
import {Vehicle} from "../../types/vehicle";
import {FuelTypeEnum, TransmissionEnum, TypeEnum} from "../../types/schema.d";
import VehicleModal from "../../components/Vehicle/VehicleModal";
import TransmissionIcon from "../../components/Vehicle/TransmissionIcon";
import FuelIcon from "../../components/Vehicle/FuelIcon";
import {Beneficiary} from "../../types/beneficiary";
import {useGetToPath, useGo} from "@refinedev/core";
import useVehicleModalForm from "../../hooks/vehicle/useVehicleModalForm";
import EditButton from "../../components/EditButton";
import VehicleStatusBadge from "../../components/Vehicle/VehicleStatusBadge";
import VehicleSearchTooltip from "../../components/Vehicle/VehicleSearchTooltip";
import VehicleAvatar from "../../components/Vehicle/VehicleAvatar";
import {humanizeNumber} from "../../constants";


const VehicleList = () => {

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
                accessor: "actions",
                title:"Actions",
                textAlignment:"center",
                render: (car) => (<EditButton record={car} showEditModal={showEditModal}/>),
            }
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
            <VehicleModal {...createModalForm}/>
            <VehicleModal {...editModalForm}/>

            <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
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