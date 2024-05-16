import {SaveButton, UseModalFormReturnType} from "@refinedev/mantine";
import React, {useEffect} from "react";
import {BaseRecord, HttpError} from "@refinedev/core";
import {BeneficiaryWritableFields} from "../../types/beneficiary";
import {Box, Group, LoadingOverlay, Modal, TextInput} from "@mantine/core";
import {DatePicker} from "@mantine/dates";
import dayjs from "dayjs";



const BeneficiaryModal: React.FC<
  UseModalFormReturnType<BaseRecord, HttpError, BeneficiaryWritableFields>
> = ({
    getInputProps,
    errors,
    modal: { visible, close, title },
    saveButtonProps,
    refineCore
}) => {

    const licenseDeliveryDateInputProps = getInputProps("license_delivery_date");

    const [licenseDeliveryDate, setLicenseDeliveryDate] = React.useState<Date | null>(licenseDeliveryDateInputProps.value ? new Date(licenseDeliveryDateInputProps.value) : null);


    useEffect(() => {
        if(!visible) return;
        setLicenseDeliveryDate(licenseDeliveryDateInputProps.value ? new Date(licenseDeliveryDateInputProps.value) : null);
    }, [licenseDeliveryDateInputProps.value, visible]);

    const handleLicenseDeliveryDateChange = (date: Date) => {
        setLicenseDeliveryDate(date);
        if(!date) return licenseDeliveryDateInputProps.onChange(undefined);
        licenseDeliveryDateInputProps.onChange(dayjs((date)).format("YYYY-MM-DD"));
    }

    return (
        <Modal opened={visible} onClose={close} title={title}>
             <LoadingOverlay visible={refineCore.formLoading} overlayBlur={2} />
            <TextInput label="Prénom" {...getInputProps("first_name")} error={errors.first_name} withAsterisk/>
            <TextInput label="Nom" {...getInputProps("last_name")} error={errors.last_name} withAsterisk/>
            <TextInput label="Adresse" {...getInputProps("address")} error={errors.address} withAsterisk/>
            <TextInput label="Complement d'adresse" {...getInputProps("address_complement")} error={errors.adress_complement} />

            <Group>
                <TextInput label="Ville" {...getInputProps("city")} error={errors.city} style={{flex:"auto"}} withAsterisk/>
                <TextInput label="Code postal" {...getInputProps("postal_code")} error={errors.postal_code} style={{flex:"auto"}} withAsterisk/>
            </Group>

            <TextInput label="Email" {...getInputProps("email")} error={errors.email} withAsterisk/>
            <TextInput label="Téléphone" {...getInputProps("phone")} error={errors.phone} withAsterisk/>
            <Group grow>
                <TextInput label="Numéro de permis" {...getInputProps("license_number")} error={errors.license_number} />
                <DatePicker locale="fr" inputFormat="DD/MM/YYYY" allowFreeInput placeholder="Date de délivrance " label="Délivré le" value={licenseDeliveryDate} onChange={handleLicenseDeliveryDateChange} error={errors.license_delivery_date}/>
            </Group>
            <Box mt={8} sx={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton {...saveButtonProps} />
            </Box>
        </Modal>
    );

}

export default BeneficiaryModal;