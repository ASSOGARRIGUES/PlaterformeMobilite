import {Contract, Payment} from "../../types/contract";
import SearchableDataTable, {SearchableDataTableColumn} from "../SearchableDataTable";
import {useMemo} from "react";
import {humanizeDate, humanizeNumber, paymentModeLabelMap} from "../../constants";
import {Group, Stack} from "@mantine/core";
import {PaymentModeEnum} from "../../types/schema.d";
import PaymentPDFButton from "./PaymentPDFButton";
import usePaymentModalForm from "../../hooks/contract/usePaymentModalForm";
import PaymentModal from "./PaymentModal";
import EditButton from "../EditButton";
import DeleteButton from "../DeleteButton";
import {useQueryClient} from "@tanstack/react-query";
import {DataTableColumn} from "mantine-datatable";
import CanAccess from "../CanAccess";

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
            <Stack gap={0}>
                <span><b>{paymentModeLabelMap[payment.mode]}</b></span>
                {payment.mode === PaymentModeEnum.check && (
                    <span>n° de chèque: <b>{payment.check_number}</b></span>
                )}
            </Stack>
        )
    }

    const paymentActionRenderer = (payment: Payment) => {
        return (
            <Group gap={3}>
                <PaymentPDFButton contract={contract} payment={payment}/>
                {payment.editable && <EditButton record={payment} showEditModal={showEditModal} permKey='api.change_payment'/>}
                {payment.editable && <DeleteButton resource={`contract/${contract.id}/payment`} id={payment.id} onDelete={invalidateSummary} permKey='api.delete_payment'/>}
            </Group>

        )
    }

    const columns = useMemo<SearchableDataTableColumn<Payment>[]>(
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
            <CanAccess permKey={'api.view_payment'}>
                <PaymentModal {...createModalForm} />
                <PaymentModal {...editModalForm} />

                <SearchableDataTable
                    withReloadIcon
                    withoutSearch
                    withArchivedSwitch={false}
                    withAddIcon = {contract.status !== "payed" && !contract.archived}
                    addPermKey={'api.add_payment'}

                    addCallback={() => {showCreateModal()}}
                    columns={columns}
                    resource={`contract/${contract.id}/payment`}
                    pageSize={4}

                />
            </CanAccess>
        </>
    )
}

export default PaymentTable;
