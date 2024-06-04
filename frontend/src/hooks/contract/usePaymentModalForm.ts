import {FormAction, RedirectAction} from "@refinedev/core/dist";
import {Contract, ContractWritableFields, Payment, WritablePayment} from "../../types/contract";
import {FormValidateInput} from "@mantine/form/lib/types";
import {useModalForm, UseModalFormReturnType} from "@refinedev/mantine";
import {BaseRecord, HttpError, useInvalidate} from "@refinedev/core";
import usePaymentSummary from "./usePaymentSummary";
import {useQueryClient} from "@tanstack/react-query";
import {useEffect, useState} from "react";

export type PaymentModalReturnType = UseModalFormReturnType<BaseRecord, HttpError, WritablePayment> & {contract: Contract};

const usePaymentModalForm = ({contract, action, redirect=false}: {contract: Contract, action: FormAction | undefined, redirect?:RedirectAction | undefined}): PaymentModalReturnType => {

    const {data: paymentSummary, isLoading: isLoadingPaymentSummary} = usePaymentSummary({contract});

    const [distantPayment, setDistantPayment] = useState<Payment | undefined>(undefined);

    const queryClient = useQueryClient();
    const invalidate = useInvalidate();

    const amountGreaterThanTotalDue = (amount: number) => {
        if(!paymentSummary) return false;
        if(action === "edit"){
            if(!distantPayment) return false;
            return amount > paymentSummary.total_due - (paymentSummary.payments_sum - distantPayment.amount);
        }else{
            return amount > paymentSummary.total_due - paymentSummary.payments_sum;
        }
    }

    const initialValues: WritablePayment = {
        mode: undefined,
        amount: 0,
        check_number: "",
    };

    const validate: FormValidateInput<WritablePayment> = {
        mode: (value) => {
            if (!value) {
                return "Le mode de paiement est requis";
            }
        },
        amount: (value) => {
            if (!value) {
                return "Le montant est requis";
            }else if(value < 0) {
                return "Le montant ne peut pas être négatif";
            }
            else if(amountGreaterThanTotalDue(value)){
                return "Le montant ne peut pas être supérieur au montant restant"
            }
        },
        check_number: (value, values) => {
            if (!value && values.mode === "check") {
                return "Le numéro de chèque est requis";
            }
        },
    }

    /*
        ################
        #  MODAL FORM  #
        ################
        */

    let modalForm = useModalForm({
        refineCoreProps: {
            resource: `contract/${contract.id}/payment`,
            action: action,
            redirect: redirect,
            onMutationSuccess: () => {
                // Invalidate the payment summary and the contract detail
                queryClient.invalidateQueries(["contract-payment-summary"]);
                invalidate({resource: 'contract', id: contract.id, invalidates:['detail']});
            }
        },
        initialValues,
        validate: validate,
        validateInputOnBlur: true,

    })

    useEffect(() => {
        if(action !== "edit") return;
        if(modalForm.refineCore.queryResult?.data?.data){
            setDistantPayment(modalForm.refineCore.queryResult?.data?.data as Payment);
        }
    }, [modalForm.refineCore.queryResult?.data?.data]);



    return {contract: contract, ...modalForm};
}

export default usePaymentModalForm;

