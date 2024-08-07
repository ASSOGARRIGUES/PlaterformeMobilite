import {BaseKey, FormAction, HttpError, RedirectAction, useList} from "@refinedev/core";
import {Vehicle, VehicleTransformedFields, VehicleWritableFields} from "../../types/vehicle";
import {FuelTypeEnum, TransmissionEnum, VehicleTypeEnum} from "../../types/schema.d";
import {useModalForm} from "@refinedev/mantine";
import {FormValidateInput} from "@mantine/form/lib/types";
import {BeneficiaryWritableFields} from "../../types/beneficiary";
import {useEffect, useState} from "react";
import {UseModalFormReturnType} from "@refinedev/mantine/dist";
import {BaseRecord} from "@refinedev/core/dist";

const useVehicleModalForm = ({action, redirect=false}: {action: FormAction | undefined, redirect?:RedirectAction | undefined}) => {

    const initialValues: VehicleWritableFields = {
        photo: undefined,
        type: VehicleTypeEnum.voiture,
        brand: "",
        color:"",
        modele: "",
        imat: "",
        fleet_id: 0,
        fuel_type: FuelTypeEnum.essence,
        year: new Date().getFullYear(),
        kilometer: 0,
        transmission: TransmissionEnum.manuelle,
    };

    const [similarFleetIds, setSimilarFleetIds] = useState<number[]>([]);

    const imatRegExp = new RegExp("^[A-Za-z]{2}-?[0-9]{3}-?[A-Za-z]{2}$");

    const validate: FormValidateInput<VehicleWritableFields> = ({
        transmission: (value) => {
            if (!value) {
                return "La transmission est requise";
            }else if(!Object.values(TransmissionEnum).includes(value)) {
                return "La transmission n'est pas valide";
            }
        },
        fleet_id: (value) => {
            if (!value) {
                return "Le numéro de flotte est requis";
            }else{
                if(similarFleetIds.includes(value)) {
                    return "Ce numéro de flotte est déjà utilisée par un autre véhicule";
                }
            }
        },
        kilometer: (value) => {
            if (!value) {
                return "Le kilométrage est requis";
            }else if(value < 0) {
                return "Le kilométrage ne peut pas être négatif";
            }
        },
        year: (value) => {
            if (!value) {
                return "L'année est requise";
            }else if(value < 1900 || value > new Date().getFullYear()) {
                return "L'année n'est pas valide";
            }
        },
        fuel_type: (value) => {
            if (!value) {
                return "Le type de carburant est requis";
            }else if(!Object.values(FuelTypeEnum).includes(value)) {
                return "Le type de carburant n'est pas valide";
            }
        },
        imat: (value) => {
            if (!value) {
                return "L'immatriculation est requise";
            }else if(!imatRegExp.test(value)) {
                return "L'immatriculation n'est pas valide";
            }
        },
        brand: (value) => {
            if (!value) {
                return "La marque est requise";
            }
        },
        modele: (value) => {
            if (!value) {
                return "Le modèle est requis";
            }
        },
        type: (value) => {
            if (!value) {
                return "Le type est requis";
            }else if(!Object.values(VehicleTypeEnum).includes(value)) {
                return "Le type n'est pas valide";
            }
        },
    })

    const modalForm: UseModalFormReturnType<BaseRecord, HttpError, VehicleWritableFields, VehicleTransformedFields> = useModalForm({
        //Provide a default id of 0 to avoid warning in the console (about missing id when provided explicit resource)
        //Id is pass through the show method anyway.
        refineCoreProps: {resource:"vehicle", action: action, redirect: redirect},
        initialValues,
        validate: validate,
        validateInputOnBlur: true,
        transformValues: (values) => ({
            ...values,
            photo: values.photo == undefined || !values.photo.includes("base64") ? undefined : values.photo,
            imat: values.imat.toUpperCase().replaceAll("-", ""),
        })
    });

    const { data, isLoading } = useList<Vehicle, HttpError>({
        resource: "vehicle",
        filters: [{field: "fleet_id", operator: "eq", value: modalForm.getInputProps("fleet_id").value}]
    });

    useEffect(() => {
        const selfId = modalForm.refineCore.id;

        const similarFleetIds = data?.data?.filter(vehicle => vehicle.id!==selfId).map(vehicle => vehicle.fleet_id) || [];
        setSimilarFleetIds(similarFleetIds);

    }, [modalForm.refineCore.id, data?.data]);

    return modalForm;
}

export default useVehicleModalForm;