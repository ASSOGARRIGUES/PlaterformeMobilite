import {List} from "@refinedev/mantine";
import {Group} from "@mantine/core";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import ContractModal from "../../components/contract/ContractModal";
import {CompleteContract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import ContractTable from "../../components/contract/ContractTable";
import {Beneficiary} from "../../types/beneficiary";
import {ContractStatusEnum} from "../../types/schema.d";
import useEndContractForm from "../../hooks/useEndContractForm";
import EndContractModal from "../../components/contract/EndContractModal";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import ContractExtraActionMenu from "../../components/contract/ContractExtraActionMenu";
import useContractModalForm from "../../hooks/contract/useContractModalForm";
import OnePDFButton from "../../components/contract/OnePDFButton";
import ContractStatusBadge from "../../components/contract/ContractStatusBadge";
import ContractEditButton from "../../components/contract/ContractEditButton";
import {humanizeDate, humanizeFirstName} from "../../constants";
import PayedContractButton from "../../components/contract/PayedContractButton";
import ContractSearchTooltip from "../../components/contract/ContractSearchTooltip";

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
                accessor:"id",
                title: "ID",
                sortable: true,
                width: 80,
            },
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
                render: (contract) => (humanizeDate(contract.start_date)),
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
                render: (contract) => (humanizeDate(contract.end_date)),
            },
            {
                accessor: "status",
                title:"Statut",
                textAlignment:"center",
                sortable: true,
                render: (contract) => (<ContractStatusBadge contract={contract}/>),
            },
            {
                accessor: 'referent',
                title: 'Référent',
                sortable: true,
                render: (contract) => {
                    return contract.referent?.hasOwnProperty("id") ? humanizeFirstName(contract.referent.first_name)+" "+contract.referent.last_name.substring(0,1).toUpperCase()+"."  : "---"
                }
            },
            {
                accessor: "action",
                title:"Actions",
                render: (contract) => {
                    return (
                        <Group>
                            {contract.status !== ContractStatusEnum.over && <ContractEditButton contract={contract} showEditModal={showEditModal} />}
                            {contract.status === ContractStatusEnum.over && <PayedContractButton contract={contract}/> }
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
                    defaultSortedColumn="start_date"
                    defaultSortedDirection="desc"
                    searchInfoTooltip={ContractSearchTooltip}
                />
            </List>
        </>
    )
}

export default ContractList;