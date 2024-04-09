import {FormAction,RedirectAction} from "@refinedev/core";
import {ContractWritableFields} from "../../types/contract";
import {BlankEnum, ReasonEnum} from "../../types/schema.d";
import {useModalForm} from "@refinedev/mantine";
import {FormValidateInput} from "@mantine/form/lib/types";


const useContractModalForm = ({action, redirect=false}: {action: FormAction | undefined, redirect?:RedirectAction | undefined}) => {
    const initialValues: ContractWritableFields = {
        vehicle: 0,
        beneficiary: 0,
        deposit: 315,
        price: 100,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        referent: 0,
        max_kilometer: 0,
        reason: BlankEnum[""],
        discount: 0,
    };

    const validate : FormValidateInput<ContractWritableFields> = {
        vehicle: (value) => {
            if (!value) {
                return "Le véhicule est requis";
            }
        },
        beneficiary: (value) => {
            if (!value) {
                return "Le bénéficiaire est requis";
            }
        },
        deposit: (value) => {
            if (!value) {
                return "Le dépôt est requis";
            }else if(value < 0) {
                return "Le dépôt ne peut pas être négatif";
            }
        },
        price: (value) => {
            if (!value) {
                return "Le prix est requis";
            }else if(value < 0) {
                return "Le prix ne peut pas être négatif";
            }
        },
        start_date: (value) => {
            if (!value) {
                return "La date de début est requise";
            }
        },
        end_date: (value) => {
            if (!value) {
                return "La date de fin est requise";
            }
        },
        referent: (value) => {
            if (!value) {
                return "Le référent est requis";
            }
        },
        max_kilometer: (value) => {
            if (!value) {
                return "Le kilométrage maximum est requis";
            }else if(value < 0) {
                return "Le kilométrage maximum ne peut pas être négatif";
            }
        },
        reason: (value) => {
            if (!value || value === BlankEnum[""]) {
                return "La raison est requise";
            }
        },
        discount: (value) => {
            if(value && value < 0) {
                return "La remise ne peut pas être négative";
            }
        },
    }

    const modalForm = useModalForm({
        refineCoreProps: {resource:"contract", action: action, redirect: redirect},
        initialValues,
        validate: validate,
        validateInputOnBlur: true,
    });

    return modalForm;
}

export default useContractModalForm;