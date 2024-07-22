import React, {useEffect} from "react";
import {Box, LoadingOverlay, Modal, NumberInput, Select} from "@mantine/core";
import "dayjs/locale/fr";
import dayjs from "dayjs";
import {ReasonEnum} from "../../types/schema.d";
import {contractReasonLabelMap} from "../../constants";
import type {ContractModalReturnType} from "../../hooks/contract/useContractModalForm";
import {DatePickerInput} from "@mantine/dates";
import { DatesRangeValue} from "@mantine/dates/lib/types/DatePickerValue";
import {SaveButton} from "../SaveButton";
import ReferentSelect from "../user/UserSelect";
import BeneficiarySelect from "../beneficiary/BeneficiarySelect";
import VehicleSelect from "../Vehicle/VehicleSelect";



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


    const [dateValue, setDateValue] = React.useState<DatesRangeValue>([null, null]);

    useEffect(() => {
        if(!visible ) return;

        const startDate = startDateInputProps.value ? new Date(startDateInputProps.value) : null;
        const endDate = endDateInputProps.value ? new Date(endDateInputProps.value) : null;

        const dateValue : DatesRangeValue = [startDate, endDate]
        setDateValue(dateValue)


    }, [startDateInputProps.value, endDateInputProps.value, visible]);

    function handleDateChange(value: DatesRangeValue) {
        setDateValue(value);

        const startDate = value[0] ? dayjs(value[0]).format("YYYY-MM-DD") : null;
        const endDate = value[1] ? dayjs(value[1]).format("YYYY-MM-DD") : null;

        startDateInputProps.onChange(startDate);
        endDateInputProps.onChange(endDate);
    }

    const {value: beneficiaryObj, ...beneficiaryInputProps} = getInputProps("beneficiary");
    const {value: vehicleObj, ...vehicleInputProps} = getInputProps("vehicle");
    const {value: referentObj, ...referentInputProps} = getInputProps("referent");

    return (
        <Modal opened={visible} onClose={close} title={title}>
            <LoadingOverlay visible={refineCore.formLoading} overlayProps={{blur:2}} />

            <BeneficiarySelect label="Bénéficiaire" value={beneficiaryObj?.id} {...beneficiaryInputProps} error={errors.beneficiary} disabled/>

            <VehicleSelect label="Véhicule" value={vehicleObj?.id} {...vehicleInputProps} error={errors.vehicle} disabled/>

            <DatePickerInput type="range" locale="fr" label="Période du contrat"  valueFormat="DD/MM/YYYY" value={dateValue} onChange={handleDateChange} error={errors.start_date} />


            <NumberInput label="Prix du contrat" {...getInputProps("price")} error={errors.price} />
            <NumberInput label="Caution" {...getInputProps("deposit")} error={errors.deposit} />
            <NumberInput label="Remise" {...getInputProps("discount")} error={errors.discount} />
            <NumberInput label="Distance maximale" {...getInputProps("max_kilometer")} error={errors.max_kilometer} />

            <Select label="Motif" {...getInputProps("reason")} error={errors.reason} data={reasonOptions}/>

            <ReferentSelect label="Référent" value={referentObj?.id} {...referentInputProps} error={errors.referent} />

            <Box mt={8} style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton {...saveButtonProps} />
            </Box>
        </Modal>
    );

}

export default ContractModal;
