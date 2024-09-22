import {List} from "@refinedev/mantine";
import {Group, useMantineTheme} from "@mantine/core";
import {useMemo} from "react";
import ContractModal from "../../components/contract/ContractModal";
import {CompleteContract, Contract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
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
import ContractSearchTooltip from "../../components/contract/ContractSearchTooltip";
import ContractNewPaymentButton from "../../components/contract/ContractNewPaymentButton";
import {useGo, useGetToPath} from "@refinedev/core";
import {DataTableColumn, DataTableRowClickHandler} from "mantine-datatable";
import {useMediaQuery} from "@mantine/hooks";
import SearchableDataTable, {SearchableDataTableColumn} from "../../components/SearchableDataTable";
import ContractStatusFilter from "../../components/contract/filters/ContractStatusFilter";
import ContractDateFilter from "../../components/contract/filters/ContractDateFilter";

const ContractList = () => {

    const theme = useMantineTheme();
    const smallerThanMd = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);

    const getToPath = useGetToPath();
    const go = useGo();

    const editModalForm = useContractModalForm({action: "edit"});
    const {modal: { show: showEditModal}} = editModalForm;

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;

    const columns = useMemo<SearchableDataTableColumn<CompleteContract>[]>(
        () => [
            {
                accessor:"id",
                title: "ID",
                sortable: true,
                width: 80,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'beneficiary',
                title: 'Bénéficiaire',
                sortable: true,
                render: (contract) => {
                    const beneficiary = contract.beneficiary as Beneficiary
                    return beneficiary.hasOwnProperty("id") ? <BeneficiaryBadge beneficiary={beneficiary} noLink/> : "Loading..."
                }
            },
            {
                accessor: 'vehicle',
                title: 'Véhicule',
                sortable: true,
                render: (contract) => {
                    const vehicle = contract.vehicle as Vehicle
                    return vehicle.hasOwnProperty("id") ? <VehicleBadge vehicle={vehicle} noColor={smallerThanMd} noLink/> : "Loading..."
                }

            },
            {
                accessor: 'start_date',
                title: 'Début',
                sortable: true,
                render: (contract) => (humanizeDate(contract.start_date)),
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`,
                filter: ContractDateFilter,
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
                render: (contract) => (humanizeDate(contract.end_date)),
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`,
                filter: ContractDateFilter,
            },
            {
                accessor: "status",
                title:"Statut",
                textAlignment:"center",
                sortable: true,
                render: (contract) => (<ContractStatusBadge contract={contract}/>),
                filter: ContractStatusFilter,
            },
            {
                accessor: 'referent',
                title: 'Référent',
                sortable: true,
                render: (contract) => {
                    return contract.referent?.hasOwnProperty("id") ? humanizeFirstName(contract.referent.first_name)+" "+contract.referent.last_name?.substring(0,1).toUpperCase()+"."  : "---"
                },
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: "action",
                title:"Actions",
                render: (contract) => {
                    return (
                        <Group>
                            {contract.status !== ContractStatusEnum.over && <ContractEditButton contract={contract} showEditModal={showEditModal} />}
                            {contract.status === ContractStatusEnum.over && <ContractNewPaymentButton contract={contract}/> }
                            <OnePDFButton contract={contract}/>
                            <ContractExtraActionMenu contract={contract} showEndModal={showEndModal}/>
                        </Group>
                    );
                },
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            }
        ],
        [],
    );

    const rowClickHandler: DataTableRowClickHandler<Contract> = ({record : contract, index, event}) => {
        const path = getToPath({
            action: "show",
            meta: {
                id: contract.id
            }
        });

        go({
            to: path
        });
    }


    return (
        <>
            <ContractModal {...editModalForm}/>
            <EndContractModal {...endModalForm}/>

            <List title="" wrapperProps={{children: undefined, style:{height:(smallerThanMd ? "100vh" : "100%"), display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}} canCreate={false}>
                <SearchableDataTable
                    resource="contract"
                    searchPlaceHolder={"Rechercher un contrat"}
                    columns={columns}

                    withAddIcon={true}
                    addCallback={() => {go({to:{resource:"contract", action:"create"}})}}
                    addPermKey={'api.add_contract'}

                    withReloadIcon

                    /*@ts-ignore*/
                    verticalSpacing="md"
                    defaultSortedColumn="start_date"
                    defaultSortedDirection="desc"
                    searchInfoTooltip={ContractSearchTooltip}

                    onRowClick={rowClickHandler}
                />
            </List>
        </>
    )
}

export default ContractList;