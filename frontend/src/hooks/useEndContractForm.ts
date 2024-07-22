import {useEffect, useState} from "react";
import {FormErrors, useForm} from "@mantine/form";
import {GetInputProps, IsValid} from "@mantine/form/lib/types";
import {BaseKey, useForm as useRefineForm} from "@refinedev/core";
import {EndContract, EndContractWritableFields} from "../types/contract";


export type UseEndContractFormType = {
    getInputProps:  GetInputProps<EndContractWritableFields>,
    errors: FormErrors,
    isFormValid: IsValid<EndContractWritableFields>,
    modal:  {
        submit: (event?: React.FormEvent<HTMLFormElement>) => void
        close: () => void;
        show: (id?: BaseKey) => void;
        visible: boolean;
        title: string;
    };
}

const useEndContractForm = (): UseEndContractFormType => {
    const[modaVisible, setModalVisible] = useState(false);
    const modalTitle = "Clôturer un contrat";

    const {onFinish, queryResult, setId} = useRefineForm({
        resource: "contract",
        action:"edit",
        meta:{
            special_action: "end"
        },
        redirect: false,
    })

    const data = queryResult?.data?.data as EndContract | undefined;


    const form = useForm({
        initialValues: {
            price: 0,
            deposit: 0,
            discount: 0,
            end_kilometer: 0,
        },
        validateInputOnBlur: true,

        validate: {
            deposit: (value) => {
                if(value==undefined) {
                    return "La caution est obligatoire";
                }else if(value < 0) {
                    return "La caution ne peut pas être négative";
                }
            },
            price: (value) => {
                if(value==undefined) {
                    return "Le prix est obligatoire";
                }else if(value < 0) {
                    return "Le prix ne peut pas être négatif";
                }
            },
            discount: (value) => {
                if(value==undefined) {
                    return "La remise est obligatoire";
                }else if(value < 0) {
                    return "La remise ne peut pas être négative";
                }
            },
            end_kilometer: (value) => {
                if(value==undefined) {
                    return "Le kilométrage de fin est obligatoire";
                }else if(value < 0) {
                    return "Le kilométrage de fin ne peut pas être négatif";
                }else if(data?.start_kilometer && value < data?.start_kilometer) {
                    return `Le kilométrage de fin ne peut pas être inférieur au kilométrage de début (kilométrage de début: ${data.start_kilometer} km)`;
                }else if(data?.vehicle_kilometer && value < data?.vehicle_kilometer) {
                    return `Le kilométrage de fin ne peut pas être inférieur au kilométrage du véhicule (kilométrage du véhicule: ${data.vehicle_kilometer} km)`;
                }
            },

        }

    })

    useEffect(() => {
        if(data) {
            if(data.end_kilometer==undefined) data.end_kilometer = 0;
            form.setValues(data);
        }
    }, [data]);


    const showModal = (id: BaseKey | undefined) => {
        setId(id);
        setModalVisible(true);
        console.log(`requesting contract ${id}`, modaVisible);
    }

    const closeModal = () => {
        setModalVisible(false);
    }

    const formSubmit = form.onSubmit(async (values) => {
        await onFinish(values);
         closeModal();
    })

    const modal = {visible: modaVisible, title: modalTitle, close: closeModal, show: showModal, submit: formSubmit};

    return {getInputProps: form.getInputProps, errors: form.errors, modal, isFormValid: form.isValid};

}

export default useEndContractForm;
