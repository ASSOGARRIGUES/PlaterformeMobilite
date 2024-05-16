import {Vehicle} from "../../types/vehicle";
import {CSSProperties, useEffect, useState} from "react";
import {Button, Loader, useMantineTheme} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";
import {useUpdate} from "@refinedev/core";
import {useDebouncedValue, useTimeout} from "@mantine/hooks";

const QuickStatusButton = ({ vehicle, style}: {vehicle: Vehicle | undefined, style?:CSSProperties}) => {

    const {mutate, isLoading} = useUpdate();

    //Add a delay to the loading state to prevent flickering
    const [debouncedLoading, setDebouncedLoading] = useState(false);
    const {start, clear} = useTimeout(()=>{setDebouncedLoading(false)}, 300);

    useEffect(() => {
        if(isLoading){
            setDebouncedLoading(true);
            clear();
        }else{
            start();
        }
    }, [isLoading]);

    const theme = useMantineTheme();

    const label = vehicle?.status === VehicleStatusEnum.maintenance ?  "Remettre en service" : "Placer en maintenance";

    const disabled = (vehicle?.status !== VehicleStatusEnum.maintenance && vehicle?.status !== VehicleStatusEnum.available) || isLoading || debouncedLoading;

    const color = vehicle?.status === VehicleStatusEnum.maintenance ? "teal" : "yellow";

    const textColor = theme.colors.dark[5];

    const handleClick = () => {
        if(!vehicle) return;
        mutate({
            resource: "vehicle",
            id: vehicle.id,
            values: {
                status: vehicle.status === VehicleStatusEnum.maintenance ? VehicleStatusEnum.available : VehicleStatusEnum.maintenance
            },
            successNotification: (data, values, resource) => ({
                message: `Le véhicule a été ${vehicle.status === VehicleStatusEnum.maintenance ? "remis en service" : "placé en maintenance"}`,
                type: "success",
                undoableTimeout: 0,
            })
        })
    }

    const loader = <Loader size="xs" color={textColor}/>;

    return (
        <Button style={{...style}} onClick={handleClick} disabled={disabled} color={color}>{isLoading? loader : label}</Button>
    )
}

export default QuickStatusButton;