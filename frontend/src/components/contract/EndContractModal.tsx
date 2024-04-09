import {Button, LoadingOverlay, Modal, NumberInput, Space} from "@mantine/core";
import React from "react";
import type {UseEndContractFormType} from "../../hooks/useEndContractForm";
import {SaveButton} from "@refinedev/mantine";


const EndContractModal = ({
                              getInputProps,
                              errors,
                              modal: { visible, close, title, submit},
                              isFormValid
                          }: UseEndContractFormType) => {

    return (
        <Modal opened={visible} onClose={close} title={title}>
            <LoadingOverlay visible={false} overlayBlur={2} />

            <form onSubmit={submit}>
                <NumberInput label="Prix du contrat" {...getInputProps("price")} error={errors.price} />
                <NumberInput label="Caution" {...getInputProps("deposit")} error={errors.deposit} />
                <NumberInput label="Remise" {...getInputProps("discount")} error={errors.discount} />

                <Space h="xl" />

                <NumberInput label="Kilométrage de la voiture" {...getInputProps("end_kilometer")} error={errors.end_kilometer} />

                <Button type="submit" color="red" sx={{marginTop: 20, width: "100%"}} disabled={isFormValid ? !isFormValid(): true}>Clôturer</Button>
            </form>
        </Modal>
    );
}

export default EndContractModal;