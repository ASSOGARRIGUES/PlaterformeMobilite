import {List, useModalForm} from "@refinedev/mantine";
import {ActionIcon, Group, Menu} from "@mantine/core";
import {IconCurrencyEuro, IconDots, IconEdit} from "@tabler/icons-react";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import ContractModal from "../../components/contract/ContractModal";
import {CompleteContract, Contract, ContractWritableFields} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import ContractTable from "../../components/contract/ContractTable";
import {Beneficiary} from "../../types/beneficiary";
import ContractIcon from "../../assets/contract.svg";
import BillIcon from "../../assets/bill.svg";
import {BlankEnum, ContractStatusEnum} from "../../types/schema.d";
import useEndContractForm from "../../hooks/useEndContractForm";
import EndContractModal from "../../components/contract/EndContractModal";
import {BaseRecord, useApiUrl, useResource} from "@refinedev/core";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import BillPDFButton from "../../components/contract/BillPDFButton";
import ContractPDFButton from "../../components/contract/ContractPDFButton";
import ContractExtraActionMenu from "../../components/contract/ContractExtraActionMenu";
import EditButton from "../../components/EditButton";
import useContractModalForm from "../../hooks/contract/useContractModalForm";
import OnePDFButton from "../../components/contract/OnePDFButton";
import ContractStatusBadge from "../../components/contract/ContractStatusBadge";

const ContractList = () => {

    const createModalForm = useContractModalForm({action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    const editModalForm = useContractModalForm({action: "edit"});
    const {modal: { show: showEditModal}} = editModalForm;

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;


    const columns = useMemo<DataTableColumn<CompleteContract>[]>(
        () => [
            {
                accessor: 'vehicle', //access nested data with dot notation
                title: 'Véhicule',
                sortable: true,
                render: (contract) => {
                    const vehicle = contract.vehicle as Vehicle
                    return vehicle.hasOwnProperty("id") ? <VehicleBadge vehicle={vehicle}/> : "Loading..."
                }

            },
            {
                accessor: 'beneficiary',
                title: 'Bénéficiaire',
                sortable: true,
                render: (contract) => {
                    const beneficiary = contract.beneficiary as Beneficiary
                    return beneficiary.hasOwnProperty("id") ? <BeneficiaryBadge beneficiary={beneficiary}/> : "Loading..."
                }
            },
            {
                accessor: 'start_date', //normal accessorKey
                title: 'Début',
                sortable: true,
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
            },
            {
                accessor: "status",
                title:"Status",
                textAlignment:"center",
                sortable: true,
                render: (contract) => (<ContractStatusBadge contract={contract}/>),
            },
            {
                accessor: "action",
                title:"Actions",
                render: (contract) => {
                    return (
                        <Group>
                            <EditButton record={contract} showEditModal={showEditModal} />
                            <OnePDFButton contract={contract}/>
                            <ContractExtraActionMenu contract={contract} showEndModal={showEndModal}/>
                        </Group>
                    );
                },
            }
        ],
        [],
    );


    return (
        <>
            <ContractModal {...createModalForm}/>
            <ContractModal {...editModalForm}/>
            <EndContractModal {...endModalForm}/>

            <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <ContractTable
                    searchPlaceHolder={"Rechercher un contrat"}
                    columns={columns}

                    withAddIcon={true}
                    addCallback={() => {showCreateModal()}}
                    withReloadIcon

                    /*@ts-ignore*/
                    verticalSpacing="md"
                />
            </List>
        </>
    )
}

export default ContractList;