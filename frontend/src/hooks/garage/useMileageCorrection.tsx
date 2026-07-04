import { useState } from "react";
import { useApiUrl, useCustomMutation, useInvalidate } from "@refinedev/core";
import { closeAllModals, openModal } from "@mantine/modals";
import { Button, NumberInput, Stack, Textarea } from "@mantine/core";
import { MileageEntry, MileageCorrectionPayload } from "../../types/garage";
import useAccessControl from "../useAccessControl";

type CorrectionFormProps = {
    initialValue: number;
    loading: boolean;
    onSubmit: (value: number, reason: string) => void;
};

const CorrectionForm = ({ initialValue, loading, onSubmit }: CorrectionFormProps) => {
    const [value, setValue] = useState<number | "">(initialValue);
    const [reason, setReason] = useState("");

    return (
        <Stack>
            <NumberInput
                label="Nouveau kilométrage"
                value={value}
                onChange={(v) => setValue(v === "" ? "" : Number(v))}
                min={0}
            />
            <Textarea
                label="Raison de la correction"
                required
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Button
                onClick={() => onSubmit(value as number, reason)}
                disabled={!reason.trim() || value === ""}
                loading={loading}
            >
                Valider
            </Button>
        </Stack>
    );
};

export const useMileageCorrection = (vehicleId: number) => {
    const apiUrl = useApiUrl();
    const { mutate, isLoading } = useCustomMutation<MileageEntry>();
    const invalidate = useInvalidate();
    const { isAuthorized } = useAccessControl();

    const openCorrectionModal = (entry: MileageEntry) => {
        openModal({
            title: "Corriger le kilométrage",
            children: (
                <CorrectionForm
                    initialValue={entry.value}
                    loading={isLoading}
                    onSubmit={(newValue, newReason) => {
                        mutate({
                            url: `${apiUrl}/garage/mileage/${vehicleId}/correct/`,
                            method: "post",
                            values: { entry: entry.id, value: newValue, reason: newReason } as MileageCorrectionPayload,
                            successNotification: { type: "success", message: "Kilométrage corrigé" },
                        }, {
                            onSuccess: () => {
                                invalidate({ resource: `garage/mileage/${vehicleId}`, invalidates: ["list"] });
                                invalidate({ resource: "vehicle", id: vehicleId, invalidates: ["detail"] });
                                closeAllModals();
                            },
                        });
                    }}
                />
            ),
        });
    };

    return {
        openCorrectionModal,
        canCorrect: !!isAuthorized("garage.correct_mileage"),
    };
};
