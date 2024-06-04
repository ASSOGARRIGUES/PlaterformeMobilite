import {FormAction, RedirectAction} from "@refinedev/core/dist";
import {Contract, ContractWritableFields, WritablePayment} from "../../types/contract";
import {FormValidateInput} from "@mantine/form/lib/types";
import {useModalForm, UseModalFormReturnType} from "@refinedev/mantine";
import {BaseRecord, HttpError, useInvalidate} from "@refinedev/core";
import usePaymentSummary from "./usePaymentSummary";
import {useQueryClient} from "@tanstack/react-query";

export type PaymentModalReturnType = UseModalFormReturnType<BaseRecord, HttpError, WritablePayment> & {contract: Contract};

const usePaymentModalForm = ({contract, action, redirect=false}: {contract: Contract, action: FormAction | undefined, redirect?:RedirectAction | undefined}): PaymentModalReturnType => {

    const {data: paymentSummary, isLoading: isLoadingPaymentSummary} = usePaymentSummary({contract});

    const queryClient = useQueryClient();

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
            }else if((paymentSummary?.total_due && paymentSummary?.payments_sum)
                && (value > paymentSummary?.total_due - paymentSummary?.payments_sum)){
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
                queryClient.invalidateQueries(["contract-payment-summary"]);
            }
        },
        initialValues,
        validate: validate,
        validateInputOnBlur: true,

    })



    return {contract: contract, ...modalForm};
}

export default usePaymentModalForm;

