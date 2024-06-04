import React from "react";
import {Box, Divider, LoadingOverlay, Modal, NumberInput, Select, Stack, TextInput, Title} from "@mantine/core";
import {SaveButton} from "../SaveButton";
import {PaymentModeEnum} from "../../types/schema.d";
import {paymentModeLabelMap} from "../../constants";
import {PaymentModalReturnType} from "../../hooks/contract/usePaymentModalForm";
import PaymentSummary from "./PaymentSummary";

const PaymentModal : React.FC<
    PaymentModalReturnType
> = ({
         getInputProps,
         contract,
         errors,
         modal: { visible, close, title },
         saveButtonProps,
         refineCore
     }) => {

    const paymentModeOptions = Object.values(PaymentModeEnum).map((mode) => ({ value: mode, label: paymentModeLabelMap[mode] }));

    const paymentModeInputProps = getInputProps("mode");

    return (
        <Modal opened={visible} onClose={close} title={"Edition paiements"}>
            <LoadingOverlay visible={refineCore.formLoading} overlayBlur={2} />

            <Stack>
                <Stack>
                    <Title order={5}>Récapitulatif: </Title>
                    <PaymentSummary contract={contract}/>
                </Stack>

                <Divider/>

                <Stack>
                    <NumberInput label="Montant" {...getInputProps("amount")} error={errors.amount} withAsterisk/>

                    <Select label="Mode de paiement" {...paymentModeInputProps} error={errors.mode} data={paymentModeOptions} withAsterisk/>

                    {paymentModeInputProps.value === PaymentModeEnum.check && (
                        <TextInput label="Numéro de chèque" {...getInputProps("check_number")} error={errors.check_number} withAsterisk/>
                    )}

                    <Box mt={8} sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <SaveButton {...saveButtonProps} />
                    </Box>
                </Stack>

            </Stack>



        </Modal>
    )

}

export default PaymentModal;