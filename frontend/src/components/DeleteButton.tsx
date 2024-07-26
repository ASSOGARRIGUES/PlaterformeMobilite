import {BaseKey, useDelete} from "@refinedev/core";
import {ActionIcon, Tooltip} from "@mantine/core";
import {IconTrash} from "@tabler/icons-react";
import {openConfirmModal} from "@mantine/modals";
import {PermissionType} from "../types/PermissionType";
import CanAccess from "./CanAccess";

const DeleteButton = ({ resource, id, onDelete, permKey}: { resource: string, id:BaseKey, onDelete?: ()=>any, permKey: PermissionType}) => {
    const { mutate } = useDelete();

    const openDeleteModal = () => {
        openConfirmModal({
            title: "Suppression",
            children: "Êtes-vous sûr de vouloir supprimer cet élément ?",
            labels: {
                confirm: "Supprimer",
                cancel: "Annuler"
            },
            onConfirm: () => {
                mutate({ resource: resource, id: id})
                if(onDelete) onDelete()
            }
        })
    }


    return (
        <CanAccess permKey={permKey}>
            <Tooltip label={"Supprimer"} position="bottom" openDelay={300}>
                <ActionIcon
                    color="red"
                    radius="md"
                    variant="subtle"
                    onClick={() => {
                        openDeleteModal()
                    }}
                >
                    <IconTrash size={25} />
                </ActionIcon>
            </Tooltip>
        </CanAccess>
    )

}

export default DeleteButton;