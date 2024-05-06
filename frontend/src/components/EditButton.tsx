import {Contract} from "../types/contract";
import {ActionIcon, Tooltip} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";


type MinimalRecord = {
    id: number
    [key: string]: any
}

const EditButton = ({record, showEditModal}: {record: MinimalRecord, showEditModal:(id:number)=>any}) => {
    return (
        <Tooltip label={"Editer"} position="bottom" openDelay={300}>
            <ActionIcon onClick={(e)=>{e.stopPropagation(); showEditModal(record.id)}}  color="blue">
                <IconEdit size={25} />
            </ActionIcon>
        </Tooltip>
    )
}

export default EditButton;