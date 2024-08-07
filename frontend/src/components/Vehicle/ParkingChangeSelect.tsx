import ParkingSelect from "./ParkingSelect";
import {Parking, Vehicle} from "../../types/vehicle";
import {ComponentProps} from "react";
import {useUpdate} from "@refinedev/core";
import {Loader} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";

const ParkingChangeSelect = ({ vehicle, disabled, ...otherProps }:{vehicle: Vehicle | undefined} & Omit<ComponentProps<typeof ParkingSelect>, "onChange">) => {

    const { mutate, isLoading } = useUpdate();

    const handleChange = (parking: Parking | undefined) => {
        if(!vehicle) return;
        if(!parking) return;

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
        <ParkingSelect {...otherProps} disabled={disabled || vehicle?.status === VehicleStatusEnum.rented} withLabel onChange={handleChange} value={vehicle?.parking} rightSection={isLoading? (<Loader size="xs"/>) : undefined}/>
    )
}

export default ParkingChangeSelect;