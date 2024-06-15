import {Contract} from "../types/contract";
import {ActionIcon, Tooltip} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";


type MinimalRecord = {
    id: number
    [key: string]: any
}

export type EditButtonProps = {record: MinimalRecord, showEditModal:(id:number)=>any, disabled?:boolean}

const EditButton = ({record, showEditModal, disabled}: EditButtonProps) => {
    return (
        <Tooltip label={"Editer"} position="bottom" openDelay={300}>
            <ActionIcon onClick={(e)=>{e.stopPropagation(); showEditModal(record.id)}}  variant="subtle" color="blue" disabled={disabled}>
                <IconEdit size={25} />
            </ActionIcon>
        </Tooltip>
    )
}

export default EditButton;