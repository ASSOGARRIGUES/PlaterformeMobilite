import {Contract} from "../types/contract";
import {ActionIcon} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";


type MinimalRecord = {
    id: number
    [key: string]: any
}

const EditButton = ({record, showEditModal}: {record: MinimalRecord, showEditModal:(id:number)=>any}) => {
    return (
        <ActionIcon onClick={(e)=>{e.stopPropagation(); showEditModal(record.id)}}  color="blue">
            <IconEdit size={25} />
        </ActionIcon>
    )
}

export default EditButton;