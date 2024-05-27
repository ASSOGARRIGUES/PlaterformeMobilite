import {useForm as useRefineForm, BaseKey, useUpdate, useApiUrl, useCustom} from "@refinedev/core";
import {Button, Loader} from "@mantine/core";
import {closeAllModals, openConfirmModal, openModal} from "@mantine/modals";
import {CSSProperties, ReactNode, useEffect} from "react";
import {ButtonProps} from "@mantine/core/lib/Button/Button";
import {axiosInstance} from "../providers/rest-data-provider/utils";
import ContractBadge from "./contract/ContractBadge";

const ArchiveButton = ({ id, ressource, modalContent, ...otherProps }: { id: BaseKey | undefined; ressource: string, modalContent: React.ReactNode } & ButtonProps) => {

    const apiUrl = useApiUrl();

    const {mutate, isLoading} = useUpdate()


    const showErrorModal = (validation_data:any) => {
        const detailsNode = validation_data.details.map((detail: any, index:number) => {
            return (
                <p key={index}><ContractBadge contract={detail.contract}/></p>
            )
        })
        const children = (
            <div>
                <p>Vous ne pouvez pas archiver cet élément</p>
                <p>{validation_data.message}</p>
                <p>Details:</p>
                <div>
                    {detailsNode}
                </div>

                <Button fullWidth onClick={()=>closeAllModals()} mt="md">
                    Fermer
                </Button>
            </div>
        )

        openModal({
            title: "Erreur",
            children: children,
        })
    }

    const showArchiveModal = () => {
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

    const showModal = async () => {

        const {data} = await axiosInstance.get(`${apiUrl}/${ressource}/${id}/archive`)


        if (!data) showArchiveModal();
        else if (data.can_archive === false) {
            showErrorModal(data)
        }else{
            showArchiveModal()
        }

    }


    return (
        <Button onClick={showModal} {...otherProps}>
            {isLoading ? <Loader size="xs"/> : "Archiver"}
        </Button>
    )
}

export default ArchiveButton;
