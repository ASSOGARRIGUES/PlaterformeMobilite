import {useShow} from "@refinedev/core";
import {Beneficiary} from "../../types/beneficiary";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import {CompleteContract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import {Group, Paper, Stack, Title} from "@mantine/core";
import {Show} from "@refinedev/mantine";
import ContractTable from "../../components/contract/ContractTable";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import VehicleCard from "../../components/Vehicle/VehicleCard";
import EditButton from "../../components/EditButton";
import ContractExtraActionMenu from "../../components/contract/ContractExtraActionMenu";
import OnePDFButton from "../../components/contract/OnePDFButton";
import ContractModal from "../../components/contract/ContractModal";
import EndContractModal from "../../components/contract/EndContractModal";
import useContractModalForm from "../../hooks/contract/useContractModalForm";
import useEndContractForm from "../../hooks/useEndContractForm";
import ContractStatusBadge from "../../components/contract/ContractStatusBadge";

const VehicleShow = (props: any) => {
    const { queryResult: showResponse } = useShow<Vehicle>()

    const vehicle  = showResponse.data?.data;

    const editModalForm = useContractModalForm({action: "edit"});
    const {modal: { show: showEditModal}} = editModalForm;

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;


    const columns = useMemo<DataTableColumn<CompleteContract>[]>(
        () => [
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
            <ContractModal {...editModalForm}/>
            <EndContractModal {...endModalForm}/>

            <Stack style={{height:"100%"}}>

                <Show title={<Title><VehicleBadge vehicle={vehicle}/> </Title>} contentProps={{style:{padding:0}}}/>

                <VehicleCard vehicle={vehicle} withEdit />

                <Paper shadow="sm" p="md" style={{flex: "auto", minHeight:0, display: "flex", flexDirection: "column", alignItems:"center", gap:"10px", paddingRight:20, paddingLeft:20, paddingTop:10}}>
                    <Title order={2}>Contrats</Title>
                    <ContractTable
                        searchPlaceHolder={"Rechercher un contrat"}
                        columns={columns}
                        withReloadIcon
                        /*@ts-ignore*/
                        verticalSpacing="md"
                        style={{flex: "auto", minHeight:0}}
                        permanentFilters={[{field: "vehicle", operator: "in", value: [vehicle?.id]}]}
                        syncWithLocation={false}
                    />
                </Paper>

            </Stack>
        </>
    )

}

export default VehicleShow;
