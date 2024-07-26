import {Contract} from "../types/contract";
import {ActionIcon, Tooltip} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";
import CanAccess from "./CanAccess";
import {PermissionType} from "../types/PermissionType";


type MinimalRecord = {
    id: number
    [key: string]: any
}

export type EditButtonProps = {record: MinimalRecord, showEditModal:(id:number)=>any, disabled?:boolean, permKey?: PermissionType | true}

const EditButton = ({record, showEditModal, disabled, permKey}: EditButtonProps) => {
    return (
        <CanAccess permKey={permKey ?? true}>
            <Tooltip label={"Editer"} position="bottom" openDelay={300}>
                <ActionIcon onClick={(e)=>{e.stopPropagation(); showEditModal(record.id)}}  variant="subtle" color="blue" disabled={disabled}>
                    <IconEdit size={25} />
                </ActionIcon>
            </Tooltip>
        </CanAccess>
    )
}

export default EditButton;