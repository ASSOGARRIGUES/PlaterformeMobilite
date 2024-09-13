import {Badge, Tooltip} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";
import {Vehicle} from "../../types/vehicle";
import {vehicleStatusLabelMap} from "../../constants";

const VehicleStatusBadge = ({vehicle}: {vehicle: Vehicle}) => {

    if(vehicle.archived) return (<Badge color="gray">Archivé</Badge>);

    const status = vehicle.status as keyof typeof VehicleStatusEnum;

    const statusColorMap: Record<string, string> = {
        [VehicleStatusEnum.available]: "teal",
        [VehicleStatusEnum.rented]: "red",
        [VehicleStatusEnum.maintenance]: "orange",
    }

    const tooltipTextMap: Record<string, string> = {
        [VehicleStatusEnum.available]: "Véhicule disponible",
        [VehicleStatusEnum.rented]: "Véhicule à disposition",
        [VehicleStatusEnum.maintenance]: "Véhicule en maintenance",
    }

    return <Tooltip label={tooltipTextMap[status]}><Badge color={statusColorMap[status]}>{vehicleStatusLabelMap[status]}</Badge></Tooltip>
}

export default VehicleStatusBadge;