import {Beneficiary, BeneficiaryWritableFields} from "../../types/beneficiary";
import {useModalForm} from "@refinedev/mantine";
import {FormAction} from "@refinedev/core";
import {BaseRecord, HttpError, RedirectAction} from "@refinedev/core/dist";
import {FormValidateInput} from "@mantine/form/lib/types";
import {humanizeFirstName, humanizeLastName} from "../../constants";
import {UseModalFormReturnType} from "@refinedev/mantine/dist/index";


const useBeneficiaryModalForm = ({action, redirect=false}: {action: FormAction | undefined, redirect?:RedirectAction | undefined}):UseModalFormReturnType<BaseRecord, HttpError, BeneficiaryWritableFields> => {

    const initialValues: BeneficiaryWritableFields = {
        first_name: "",
        last_name: "",
        address: "",
        city: "",
        email: "",
        phone: "",
        postal_code: "",
        address_complement: "",
        license_number: "",
        license_delivery_date: "",
    };

    const emailRegExp = new RegExp("^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,6}$");
    const phoneRegExp = new RegExp("^(?:(?:\\+|00)33|0)\\s*[1-9](?:[\\s.-]*\\d{2}){4}$");
    const postalCodeRegExp = new RegExp("^(?:0[1-9]|[1-8]\\d|9[0-8])\\d{3}$");
    const licenseNumberRegExp = new RegExp("^[0-9]{2}[a-zA-Z]{2}[0-9]{5}$");

    const validate: FormValidateInput<BeneficiaryWritableFields> = {
        first_name: (value) => {
            if (!value) {
                return "Le prénom est requis";
            }
        },
        last_name: (value) => {
            if (!value) {
                return "Le nom est requis";
            }
        },
        address: (value) => {
            if (!value) {
                return "L'adresse est requise";
            }
        },
        city: (value) => {
            if (!value) {
                return "La ville est requise";
            }
        },
        email: (value) => {
            if (!value) {
                return "L'email est requis";
            }else if(!emailRegExp.test(value)) {
                return "L'email n'est pas valide";
            }
        },
        phone: (value) => {
            if (!value) {
                return "Le téléphone est requis";
            }else if(!phoneRegExp.test(value)) {
                return "Le téléphone n'est pas valide";
            }
        },
        postal_code: (value) => {
            if (!value) {
                return "Le code postal est requis";
            }else if(!postalCodeRegExp.test(value)) {
                return "Le code postal n'est pas valide";
            }
        },
        license_delivery_date: (value, values) => {
            if(values.license_number && !value) {
                return "La date de délivrance du permis est requise";
            }
        },
        license_number: (value, values) => {
            if(values.license_delivery_date && !value) {
                return "Le numéro de permis est requis";
            }
        }
        // license_number: (value) => {
        //     if (!value) {
        //         return "Le numéro de permis est requis";
        //     }else if(!licenseNumberRegExp.test(value)) {
        //         return "Le numéro de permis n'est pas un numéro de permis français valide";
        //     }
        // },
    }

    const modalForm = useModalForm<BaseRecord,HttpError,BeneficiaryWritableFields>({
        //Provide a default id of 0 to avoid warning in the console (about missing id when provided explicit resource)
        //Id is pass through the show method anyway.
        refineCoreProps: {resource:"beneficiary", action: action, redirect: redirect },
        initialValues,
        validate: validate,
        transformValues: (values) => ({
             ...values,
            phone: values.phone.replace(/\s/g, ""),
            license_number: values.license_number?.toUpperCase() ?? "",
            license_delivery_date: !values.license_delivery_date || values.license_delivery_date == "" ?  undefined : values.license_delivery_date,
            first_name: humanizeFirstName(values.first_name),
            last_name: humanizeLastName(values.last_name),
        }),
        validateInputOnBlur: true,
    });


    return modalForm;

}

export default useBeneficiaryModalForm;