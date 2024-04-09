import {SaveButton, UseModalFormReturnType} from "@refinedev/mantine";
import React from "react";
import {BaseRecord, HttpError} from "@refinedev/core";
import {BeneficiaryWritableFields} from "../../types/beneficiary";
import {Box, Group, LoadingOverlay, Modal, TextInput} from "@mantine/core";



const BeneficiaryModal: React.FC<
  UseModalFormReturnType<BaseRecord, HttpError, BeneficiaryWritableFields>
> = ({
    getInputProps,
    errors,
    modal: { visible, close, title },
    saveButtonProps,
    refineCore
}) => {


    return (
        <Modal opened={visible} onClose={close} title={title}>
             <LoadingOverlay visible={refineCore.formLoading} overlayBlur={2} />
            <TextInput label="Prénom" {...getInputProps("first_name")} error={errors.first_name} />
            <TextInput label="Nom" {...getInputProps("last_name")} error={errors.last_name} />
            <TextInput label="Adresse" {...getInputProps("address")} error={errors.address} />
            <TextInput label="Complement d'adresse" {...getInputProps("address_complement")} error={errors.adress_complement} />
            <Group>
                <TextInput label="Ville" {...getInputProps("city")} error={errors.city} style={{flex:"auto"}} />
                <TextInput label="Code postal" {...getInputProps("postal_code")} error={errors.postal_code} style={{flex:"auto"}}/>
            </Group>

            <TextInput label="Email" {...getInputProps("email")} error={errors.email} />
            <TextInput label="Téléphone" {...getInputProps("phone")} error={errors.phone} />
            <TextInput label="Numéro de permis" {...getInputProps("license_number")} error={errors.license_number} />
            <Box mt={8} sx={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton {...saveButtonProps} />
            </Box>
        </Modal>
    );

}

export default BeneficiaryModal;