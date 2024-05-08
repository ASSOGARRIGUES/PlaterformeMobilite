import {FormAction,RedirectAction} from "@refinedev/core";
import {ContractWritableFields} from "../../types/contract";
import {BlankEnum, ReasonEnum} from "../../types/schema.d";
import {useModalForm, UseSelectReturnType,UseModalFormReturnType, useSelect} from "@refinedev/mantine";
import {FormValidateInput, LooseKeys} from "@mantine/form/lib/types";
import {BaseRecord, HttpError} from "@refinedev/core/dist";
import {DEBOUNCE_TIME} from "../../constants";

//Building a GetSelectProps function to get the selectProps of a specific field just as the getInputProps function does
export type ContractGetSelectPropsFields<Values> = <Field extends LooseKeys<Values>>(path: Field) => UseSelectReturnType["selectProps"] & {isLoading: boolean};


//Modifiy this type to add a new Selectable fields. WARNING: don't forget to add the logic to query the selectable fields and add it to the getSelectProps function below
export type ContractSelectableFields = Pick<ContractWritableFields, "vehicle" | "beneficiary" | "referent">;


//Rebuilding the type of UseModalFormReturnType to add the new getSelectProps function
export type ContractModalReturnType = UseModalFormReturnType<BaseRecord, HttpError, ContractWritableFields> & {getSelectProps: ContractGetSelectPropsFields<ContractSelectableFields>};

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

    /*
        ##############
        #  VEHICLE   #
        ##############
     */
     const {selectProps: vehicleSelectProps, queryResult: {isFetching: isVehicleLoading}} = useSelect({
        resource: "vehicle",
        optionLabel: (vehicle) => `${vehicle.fleet_id} - ${vehicle.brand} ${vehicle.modele} - ${vehicle.imat}`,
        filters:[{field: "status", operator: "in", value: ["available"]}],
        onSearch: (value) => [
            {
                field: "search",
                operator: "eq",
                value,
            },
        ],
        debounce: DEBOUNCE_TIME
    })

    /*
        ##################
        #  BENEFICIARY   #
        ##################
     */
    const {selectProps: beneficiarySelectProps, queryResult: {isFetching: isBeneficiaryLoading}} = useSelect({
        resource: "beneficiary",
        optionLabel: (beneficiary) => `${beneficiary.first_name} ${beneficiary.last_name}`,
        onSearch: (value) => [
            {
                field: "search",
                operator: "eq",
                value,
            },
        ],
        debounce: DEBOUNCE_TIME,
    })

    /*
        ###############
        #  REFERENT   #
        ###############
     */
    const {selectProps: userSelectProps, queryResult: {isFetching: isUserLoading}} = useSelect({
        resource: "user",
        optionLabel: (user) => `${user.first_name} ${user.last_name}`,
        onSearch: (value) => [
            {
                field: "search",
                operator: "eq",
                value,
            },
        ],
        debounce: DEBOUNCE_TIME,
    })

    /*
        ################
        #  MODAL FORM  #
        ################
     */

    let modalForm = useModalForm({
        refineCoreProps: {resource:"contract", action: action, redirect: redirect},
        initialValues,
        validate: validate,
        validateInputOnBlur: true,
    }) as ContractModalReturnType;



    //Building the getSelectProps function with the same method as the one used for getInputProps (see type definition above)
    /**
     * Get the selectProps of a specific field
     * @param field
     */
    modalForm.getSelectProps = (field: LooseKeys<ContractSelectableFields>) => {
        switch (field) {
            case "vehicle":
                return {...vehicleSelectProps, isLoading: isVehicleLoading};
            case "beneficiary":
                return {...beneficiarySelectProps, isLoading: isBeneficiaryLoading};
            case "referent":
                return {...userSelectProps, isLoading: isUserLoading};
            default:
                throw new Error(`Field ${field} is not a select field of the form`);
        }
    }


    return modalForm;
}

export default useContractModalForm;