import {SaveButton, UseModalFormReturnType} from "@refinedev/mantine";
import React from "react";
import {BaseRecord, HttpError} from "@refinedev/core";
import {Box, FileInput, Group, Input, LoadingOverlay, Modal, NumberInput, Select, TextInput} from "@mantine/core";
import {VehicleTransformedFields, VehicleWritableFields} from "../../types/vehicle";
import {FuelTypeEnum, TransmissionEnum, VehicleTypeEnum} from "../../types/schema.d";
import AvatarUpload from "./AvatarUpload";
import {useId} from "@mantine/hooks";
import InputMask from "react-input-mask";
import {vehicleTypeLabelMap} from "../../constants";


const VehicleModal: React.FC<
    UseModalFormReturnType<BaseRecord, HttpError, VehicleWritableFields, VehicleTransformedFields>
> = ({
         getInputProps,
         errors,
         modal: { visible, close, title },
         saveButtonProps,
         refineCore

     }) => {



    const fueltypedata = Object.keys(FuelTypeEnum).map((key) =>  ({value: key, label: FuelTypeEnum[key as keyof typeof FuelTypeEnum]}));
    const transmissiondata = Object.keys(TransmissionEnum).map((key) =>  ({value: key, label: TransmissionEnum[key as keyof typeof TransmissionEnum]}));
    const vehicledata = Object.keys(VehicleTypeEnum).map((key) =>  ({value: key, label: vehicleTypeLabelMap[key]}));

    const imat_in_id = useId();

    return (
        <Modal opened={visible} onClose={close} title={title} size="lg">
            <LoadingOverlay visible={refineCore.formLoading} overlayProps={{blur:2}} />

            {/*<FileInput label="Photo" {...getInputProps("photo")} error={errors.photo} />*/}
            <AvatarUpload {...getInputProps("photo")}/>
            <Select label="Type de véhicule" data={vehicledata} {...getInputProps("type")} error={errors.type}/>
            <NumberInput label="Numéro de flotte" {...getInputProps("fleet_id")} error={errors.fleet_id} />
            {/*<TextInput label="Immatriculation" {...getInputProps("imat")} error={errors.imat} />*/}

            <Group grow>
                <Input.Wrapper id={imat_in_id} label="Immatriculation"  error={errors.imat}>
                    <Input component={InputMask} mask="aa-999-aa" id={imat_in_id} {...getInputProps("imat")} />
                </Input.Wrapper>
                <TextInput label="Année" {...getInputProps("year")} error={errors.year}/>
            </Group>


            <Group grow>
                <TextInput label="Marque" {...getInputProps("brand")} error={errors.brand} />
                <TextInput label="Modèle" {...getInputProps("modele")} error={errors.modele} />
                <TextInput label="Couleur" {...getInputProps("color")} error={errors.color} />
            </Group>

            <Group grow>
                <Select label="Carburant" data={fueltypedata} {...getInputProps("fuel_type")} error={errors.fuel_type}/>
                <Select label="Transmission" data={transmissiondata} {...getInputProps("transmission")} error={errors.transmission}/>
            </Group>

            <NumberInput label="Kilometrage" {...getInputProps("kilometer")} error={errors.kilometer} />
            <Box mt={8} style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton {...saveButtonProps} />
            </Box>
        </Modal>
    );

}

export default VehicleModal;