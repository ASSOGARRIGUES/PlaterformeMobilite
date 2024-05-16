import {Paper, Stack} from "@mantine/core";
import {Vehicle} from "../../types/vehicle";
import ParkingSelect from "./ParkingSelect";
import {CSSProperties} from "react";
import ParkingChangeSelect from "./ParkingChangeSelect";
import QuickStatusButton from "./QuickStatusButton";
import ArchiveButton from "../ArchiveButton";

const VehicleActions = ({ vehicle, style}: { vehicle: Vehicle  | undefined, style?:CSSProperties}) => {

    return (
        <Paper shadow="sm" p="md" style={{...style}} >
            <Stack>
                <QuickStatusButton vehicle={vehicle} disabled={vehicle?.archived}/>
                <ParkingChangeSelect vehicle={vehicle} disabled={vehicle?.archived}/>
                <ArchiveButton id={vehicle?.id} ressource="vehicle" modalContent={"Etes vous certains de vouloir archiver ce véhicule ?"} disabled={vehicle?.archived}/>
            </Stack>
        </Paper>
    )
}

export default VehicleActions;