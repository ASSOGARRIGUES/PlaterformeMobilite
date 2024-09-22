import ParkingSelect from "./ParkingSelect";
import {Parking, Vehicle} from "../../types/vehicle";
import {ComponentProps} from "react";
import {useUpdate} from "@refinedev/core";
import {Loader} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";
import CanAccess from "../CanAccess";

const ParkingChangeSelect = ({ vehicle, disabled, withLabel=true, ...otherProps }:{vehicle: Vehicle | undefined} & Omit<ComponentProps<typeof ParkingSelect>, "onChange">) => {

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
        <CanAccess permKey={['api.view_parking', 'api.change_vehicle']}>
            <ParkingSelect
                {...otherProps}
                disabled={disabled || vehicle?.status === VehicleStatusEnum.rented}
                onChange={handleChange} value={vehicle?.parking}
                rightSection={isLoading? (<Loader size="xs"/>) : undefined}
                filters={[{field: "actions", operator: "eq", value: vehicle?.action.id}]}
                
            />
        </CanAccess>
    )
}

export default ParkingChangeSelect;