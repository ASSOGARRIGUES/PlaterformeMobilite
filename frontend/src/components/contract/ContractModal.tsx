import React, {useEffect} from "react";
import {SaveButton, UseModalFormReturnType, useSelect} from "@refinedev/mantine";
import {BaseRecord, HttpError} from "@refinedev/core";
import {Box, Group, Loader, LoadingOverlay, Modal, NumberInput, Select, TextInput} from "@mantine/core";
import {ContractWritableFields} from "../../types/contract";
import {DatePicker, DateRangePicker, DateRangePickerValue} from "@mantine/dates";
import "dayjs/locale/fr";
import dayjs from "dayjs";
import {ReasonEnum} from "../../types/schema.d";
import {contractReasonLabelMap, DEBOUNCE_TIME} from "../../constants";
import type {ContractModalReturnType} from "../../hooks/contract/useContractModalForm";



const ContractModal : React.FC<
    ContractModalReturnType
> = ({
         getInputProps,
         getSelectProps,
         errors,
         modal: { visible, close, title },
         saveButtonProps,
         refineCore
     }) => {


    const reasonOptions = Object.values(ReasonEnum).map((reason) => ({ value: reason, label: contractReasonLabelMap[reason] }));

    const startDateInputProps = getInputProps("start_date");
    const endDateInputProps = getInputProps("end_date");


    const [dateValue, setDateValue] = React.useState<DateRangePickerValue>([new Date(startDateInputProps.value), new Date(endDateInputProps.value)]);

    useEffect(() => {
        if(!visible) return;
        setDateValue([new Date(startDateInputProps.value), new Date(endDateInputProps.value)])
    }, [startDateInputProps.value, endDateInputProps.value, visible]);


    function handleDateChange(value: DateRangePickerValue) {
        setDateValue(value);
        startDateInputProps.onChange(dayjs(value[0]).format("YYYY-MM-DD"));
        endDateInputProps.onChange(dayjs(value[1]).format("YYYY-MM-DD"));
    }

    const {isLoading: isBeneficiaryLoading, ...beneficiarySelectProps} = getSelectProps("beneficiary");
    const {isLoading: isVehicleLoading, ...vehicleSelectProps} = getSelectProps("vehicle");
    const {isLoading: isReferentLoading, ...referentSelectProps} = getSelectProps("referent");

    const {value: beneficiaryObj, ...beneficiaryInputProps} = getInputProps("beneficiary");
    const {value: vehicleObj, ...vehicleInputProps} = getInputProps("vehicle");
    const {value: referentObj, ...referentInputProps} = getInputProps("referent");

    return (
        <Modal opened={visible} onClose={close} title={title}>
            <LoadingOverlay visible={refineCore.formLoading} overlayBlur={2} />

            <Select label="Bénéficiaire" value={beneficiaryObj?.id} {...beneficiaryInputProps} error={errors.beneficiary}  {...beneficiarySelectProps}  rightSection={isBeneficiaryLoading ? <Loader  size="xs" variant="bars"/>: undefined}/>

            <Select label="Véhicule" value={vehicleObj?.id} {...vehicleInputProps} error={errors.vehicle}  {...vehicleSelectProps} rightSection={isVehicleLoading ? <Loader  size="xs" variant="bars"/>: undefined}/>

            <DateRangePicker locale="fr" label="Période du contrat" inputFormat="DD MMMM YYYY" labelFormat="DD-MM-YYYY" value={dateValue} onChange={handleDateChange} error={errors.start_date} placeholder="Début" />

            <NumberInput label="Prix du contrat" {...getInputProps("price")} error={errors.price} />
            <NumberInput label="Caution" {...getInputProps("deposit")} error={errors.deposit} />
            <NumberInput label="Remise" {...getInputProps("discount")} error={errors.discount} />
            <NumberInput label="Distance maximale" {...getInputProps("max_kilometer")} error={errors.max_kilometer} />

            <Select label="Motif" {...getInputProps("reason")} error={errors.reason} data={reasonOptions}/>

            <Select label="Référent" value={referentObj?.id} {...referentInputProps} error={errors.referent}  {...referentSelectProps} rightSection={isReferentLoading ? <Loader  size="xs" variant="bars"/>: undefined}/>

            <Box mt={8} sx={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton {...saveButtonProps} />
            </Box>
        </Modal>
    );

}

export default ContractModal;
