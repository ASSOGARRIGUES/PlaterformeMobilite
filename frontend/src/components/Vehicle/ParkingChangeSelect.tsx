import ParkingSelect from "./ParkingSelect";
import {Parking, Vehicle} from "../../types/vehicle";
import {CSSProperties} from "react";
import {useUpdate} from "@refinedev/core";
import {Loader} from "@mantine/core";

const ParkingChangeSelect = ({ vehicle, style }:{vehicle: Vehicle | undefined, style?: CSSProperties}) => {

    const { mutate, isLoading } = useUpdate();

    const handleChange = (parking: Parking) => {
        if(!vehicle) return;

        mutate({
            resource: "vehicle",
            id: vehicle.id,
            values: {
                parking: parking.id
            },
            successNotification: (data, values, resource) => ({
                message: `Le véhicule a été déplacé vers le parking ${parking.name}`,
                type: "success",
                undoableTimeout: 0,
            })
        })
    }

    return (
        <ParkingSelect withLabel onChange={handleChange} value={vehicle?.parking} style={style} rightSection={isLoading? (<Loader size="xs"/>) : undefined}/>
    )
}

export default ParkingChangeSelect;