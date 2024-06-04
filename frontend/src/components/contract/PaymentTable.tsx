import {Contract, Payment} from "../../types/contract";
import SearchableDataTable from "../SearchableDataTable";
import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import {humanizeDate, humanizeNumber, paymentModeLabelMap} from "../../constants";
import {Group, Stack} from "@mantine/core";
import {PaymentModeEnum} from "../../types/schema.d";
import PaymentPDFButton from "./PaymentPDFButton";
import usePaymentModalForm from "../../hooks/contract/usePaymentModalForm";
import PaymentModal from "./PaymentModal";
import EditButton from "../EditButton";
import DeleteButton from "../DeleteButton";
import {useQueryClient} from "@tanstack/react-query";

const PaymentTable = ({contract}: {contract: Contract}) => {

    const createModalForm = usePaymentModalForm({contract, action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    const editModalForm = usePaymentModalForm({contract, action: "edit"});
    const {modal: { show: showEditModal}} = editModalForm;

    const queryClient = useQueryClient()

    const invalidateSummary = () => {
        queryClient.invalidateQueries(["contract-payment-summary"]);
    }

    const paymentModeRenderer = (payment: Payment) => {
        return (
            <Stack spacing={0}>
                <span><b>{paymentModeLabelMap[payment.mode]}</b></span>
                {payment.mode === PaymentModeEnum.check && (
                    <span>n° de chèque: <b>{payment.check_number}</b></span>
                )}
            </Stack>
        )
    }

    const paymentActionRenderer = (payment: Payment) => {
        return (
            <Group spacing={3}>
                <PaymentPDFButton contract={contract} payment={payment}/>
                {payment.editable && <EditButton record={payment} showEditModal={showEditModal}/>}
                {payment.editable && <DeleteButton resource={`contract/${contract.id}/payment`} id={payment.id} onDelete={invalidateSummary}/>}
            </Group>

        )
    }

    const columns = useMemo<DataTableColumn<Payment>[]>(
        () => [
            {
                accessor: 'mode',
                title: 'Mode',
                sortable: true,
                render: paymentModeRenderer
            },
            {
                accessor: 'created_at',
                title: 'Date',
                sortable: true,
                render: (payment) => (humanizeDate(payment.created_at)),
            },
            {
                accessor: 'amount',
                title: 'Montant',
                sortable: true,
                render: (payment) => (humanizeNumber(payment.amount)+" €"),
            },
            {
                accessor: 'action',
                title: 'Action',
                sortable: false,
                render: paymentActionRenderer,
                width: 120,
            }

        ], [])

    return (
        <>
            <PaymentModal {...createModalForm} />
            <PaymentModal {...editModalForm} />

            <SearchableDataTable
                withReloadIcon
                withoutSearch
                withArchivedSwitch={false}
                withAddIcon = {contract.status !== "payed" && !contract.archived}
                addCallback={() => {showCreateModal()}}
                columns={columns}
                resource={`contract/${contract.id}/payment`}
                pageSize={4}

            />
        </>
    )
}

export default PaymentTable;
