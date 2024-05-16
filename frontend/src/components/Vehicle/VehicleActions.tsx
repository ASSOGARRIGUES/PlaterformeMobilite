import {Paper, Stack} from "@mantine/core";
import {Vehicle} from "../../types/vehicle";
import ParkingSelect from "./ParkingSelect";
import {CSSProperties} from "react";
import ParkingChangeSelect from "./ParkingChangeSelect";
import QuickStatusButton from "./QuickStatusButton";

const VehicleActions = ({ vehicle, style}: { vehicle: Vehicle  | undefined, style?:CSSProperties}) => {

    return (
        <Paper shadow="sm" p="md" style={{...style}} >
            <Stack>
                <QuickStatusButton vehicle={vehicle}/>
                <ParkingChangeSelect vehicle={vehicle}/>
            </Stack>
        </Paper>
    )
}

export default VehicleActions;