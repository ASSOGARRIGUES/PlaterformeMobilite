import {Show} from "@refinedev/mantine";
import {useShow} from "@refinedev/core";
import BeneficiaryCard from "../../components/beneficiary/BeneficiaryCard";
import {ActionIcon, Box, Center, Flex, Group, Paper, Stack, Title} from "@mantine/core";
import BeneficiaryModal from "../../components/beneficiary/BeneficiaryModal";
import useBeneficiaryModalForm from "../../hooks/beneficiary/useBeneficiaryModalForm";
import {Beneficiary} from "../../types/beneficiary";
import {IconEdit} from "@tabler/icons-react";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import {CompleteContract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import ContractTable from "../../components/contract/ContractTable";
import EditButton from "../../components/EditButton";
import OnePDFButton from "../../components/contract/OnePDFButton";
import ContractExtraActionMenu from "../../components/contract/ContractExtraActionMenu";
import ContractModal from "../../components/contract/ContractModal";
import EndContractModal from "../../components/contract/EndContractModal";
import useContractModalForm from "../../hooks/contract/useContractModalForm";
import useEndContractForm from "../../hooks/useEndContractForm";
import ContractStatusBadge from "../../components/contract/ContractStatusBadge";
import ContractEditButton from "../../components/contract/ContractEditButton";
import {humanizeDate} from "../../constants";


const BeneficiaryShow = () => {
    const { queryResult: showResponse } = useShow<Beneficiary>()

    const beneficiary  = showResponse.data?.data;

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
                    return vehicle?.hasOwnProperty("id") ? <VehicleBadge vehicle={vehicle}/> : "Loading..."
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
                            <ContractEditButton  contract={contract} showEditModal={showEditModal} />
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
            <ContractModal {...editModalForm}/>
            <EndContractModal {...endModalForm}/>


            <Stack style={{height:"100%"}}>

                <Show title={<Title>{beneficiary?.first_name} {beneficiary?.last_name}</Title>} contentProps={{style:{padding:0}}}/>

                <BeneficiaryCard beneficiary={beneficiary} withEdit />

                <Paper shadow="sm" p="md" style={{flex: "auto", minHeight:0, display: "flex", flexDirection: "column", alignItems:"center", gap:"10px", paddingRight:20, paddingLeft:20, paddingTop:10}}>
                    <Title order={2}>Contrats</Title>
                    <ContractTable
                        searchPlaceHolder={"Rechercher un contrat"}
                        columns={columns}
                        withReloadIcon
                        /*@ts-ignore*/
                        verticalSpacing="md"
                        style={{flex: "auto", minHeight:0}}
                        permanentFilters={[{field: "beneficiary", operator: "in", value: [beneficiary?.id]}]}
                        syncWithLocation={false}
                        defaultSortedColumn="start_date"
                        defaultSortedDirection="desc"
                    />
                </Paper>

            </Stack>
        </>
    )

}

export default BeneficiaryShow;