import {useForm as useRefineForm, BaseKey, useUpdate} from "@refinedev/core";
import {Button, Loader} from "@mantine/core";
import {openConfirmModal, openModal} from "@mantine/modals";
import {CSSProperties} from "react";
import {ButtonProps} from "@mantine/core/lib/Button/Button";

const ArchiveButton = ({ id, ressource, modalContent, ...otherProps }: { id: BaseKey | undefined; ressource: string, modalContent: React.ReactNode } & ButtonProps) => {
    const {mutate, isLoading} = useUpdate()

    const showModal = () => {
        openConfirmModal({
            title: "Archiver",
            children:  modalContent,
            labels: {
                cancel: "Annuler",
                confirm: "Archiver"
            },
            onConfirm: () => {
                if(!id) return;
                mutate({
                    resource: ressource,
                    id: id,
                    meta:{
                        special_action: "archive"
                    },
                    values: {},
                })
            },
        })
    }


    return (
        <Button onClick={showModal} {...otherProps}>
            {isLoading ? <Loader size="xs"/> : "Archiver"}
        </Button>
    )
}

export default ArchiveButton;
