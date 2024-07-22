import {ActionIcon, Group} from "@mantine/core";
import {IconChevronLeft, IconChevronRight} from "@tabler/icons-react";

const Shifter = ({value, onChange, min, max}: {value:number, onChange : (value:number) => void, min: number, max:number}) => {

    const decrement = () => {
        if(value>min) onChange(value-1);
    }

    const increment = () => {
        if (value < max) onChange(value + 1);
    }

    return (
        <Group>
            <ActionIcon onClick={()=>decrement()} variant="subtle">
                <IconChevronLeft/>
            </ActionIcon>
            {value}/{max}
            <ActionIcon onClick={()=>increment()} variant="subtle">
                <IconChevronRight/>
            </ActionIcon>
        </Group>
    )

}
export default Shifter;