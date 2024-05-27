import {Paper, Stack} from "@mantine/core";
import {Vehicle} from "../../types/vehicle";
import ParkingSelect from "./ParkingSelect";
import {CSSProperties} from "react";
import ParkingChangeSelect from "./ParkingChangeSelect";
import QuickStatusButton from "./QuickStatusButton";
import ArchiveButton from "../ArchiveButton";
import VehicleArchiveButton from "./VehicleArchiveButton";

const VehicleActions = ({ vehicle, style}: { vehicle: Vehicle  | undefined, style?:CSSProperties}) => {

    return (
        <Paper shadow="sm" p="md" style={{...style}} >
            <Stack>
                <QuickStatusButton vehicle={vehicle} disabled={vehicle?.archived}/>
                <ParkingChangeSelect vehicle={vehicle} disabled={vehicle?.archived}/>
                <VehicleArchiveButton vehicle={vehicle}/>
            </Stack>
        </Paper>
    )
}

export default VehicleActions;