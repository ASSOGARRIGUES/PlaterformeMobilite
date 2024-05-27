import ParkingSelect from "./ParkingSelect";
import {Parking, Vehicle} from "../../types/vehicle";
import {ComponentProps, CSSProperties} from "react";
import {useUpdate} from "@refinedev/core";
import {Loader} from "@mantine/core";
import {SelectProps} from "@mantine/core/lib/Select/Select";

const ParkingChangeSelect = ({ vehicle, ...otherProps }:{vehicle: Vehicle | undefined} & Omit<ComponentProps<typeof ParkingSelect>, "onChange">) => {

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
        <ParkingSelect {...otherProps} withLabel onChange={handleChange} value={vehicle?.parking} rightSection={isLoading? (<Loader size="xs"/>) : undefined}/>
    )
}

export default ParkingChangeSelect;