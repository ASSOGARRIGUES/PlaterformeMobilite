import React from "react";
import {SaveButton, UseModalFormReturnType, useSelect} from "@refinedev/mantine";
import {BaseRecord, HttpError} from "@refinedev/core";
import {Box, Group, Loader, LoadingOverlay, Modal, NumberInput, Select, TextInput} from "@mantine/core";
import {ContractWritableFields} from "../../types/contract";
import {DatePicker, DateRangePicker, DateRangePickerValue} from "@mantine/dates";
import "dayjs/locale/fr";
import dayjs from "dayjs";
import {ReasonEnum} from "../../types/schema.d";
import {contractReasonLabelMap, DEBOUNCE_TIME} from "../../constants";


const ContractModal : React.FC<
    UseModalFormReturnType<BaseRecord, HttpError, ContractWritableFields>
> = ({
         getInputProps,
         errors,
         modal: { visible, close, title },
         saveButtonProps,
         refineCore
     }) => {

    const {selectProps: vehicleSelectProps, queryResult: {isFetching: isVehicleLoading}} = useSelect({
        resource: "vehicle",
        optionLabel: (vehicle) => `${vehicle.fleet_id} - ${vehicle.brand} ${vehicle.modele} - ${vehicle.imat}`,
        onSearch: (value) => [
            {
                field: "search",
                operator: "eq",
                value,
            },
        ],
        debounce: DEBOUNCE_TIME
    })


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

    const reasonOptions = Object.values(ReasonEnum).map((reason) => ({ value: reason, label: contractReasonLabelMap[reason] }));

    const startDateInputProps = getInputProps("start_date");
    const endDateInputProps = getInputProps("end_date");

    const [dateValue, setDateValue] = React.useState<DateRangePickerValue>([new Date(startDateInputProps.value), new Date(endDateInputProps.value)]);

    function handleDateChange(value: DateRangePickerValue) {
        setDateValue(value);
        startDateInputProps.onChange(dayjs(value[0]).format("YYYY-MM-DD"));
        endDateInputProps.onChange(dayjs(value[1]).format("YYYY-MM-DD"));
    }


    return (
        <Modal opened={visible} onClose={close} title={title}>
            <LoadingOverlay visible={refineCore.formLoading} overlayBlur={2} />

            <Select label="Bénéficiaire" {...getInputProps("beneficiary")} error={errors.beneficiary}  {...beneficiarySelectProps}  rightSection={isBeneficiaryLoading ? <Loader  size="xs" variant="bars"/>: undefined}/>

            <Select label="Véhicule" {...getInputProps("vehicle")} error={errors.vehicle}  {...vehicleSelectProps} rightSection={isVehicleLoading ? <Loader  size="xs" variant="bars"/>: undefined}/>

            <DateRangePicker locale="fr" label="Période du contrat" inputFormat="DD MMMM YYYY" labelFormat="DD-MM-YYYY" value={dateValue} onChange={handleDateChange} error={errors.start_date} placeholder="Début" />

            <NumberInput label="Prix du contrat" {...getInputProps("price")} error={errors.price} />
            <NumberInput label="Caution" {...getInputProps("deposit")} error={errors.deposit} />
            <NumberInput label="Remise" {...getInputProps("discount")} error={errors.discount} />
            <NumberInput label="Distance maximale" {...getInputProps("max_kilometer")} error={errors.max_kilometer} />

            <Select label="Motif" {...getInputProps("reason")} error={errors.reason} data={reasonOptions}/>

            <Select label="Référent" {...getInputProps("referent")} error={errors.referent}  {...userSelectProps} rightSection={isUserLoading ? <Loader  size="xs" variant="bars"/>: undefined}/>

            <Box mt={8} sx={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton {...saveButtonProps} />
            </Box>
        </Modal>
    );

}

export default ContractModal;
