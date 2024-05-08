import {Badge, Tooltip} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";
import {Vehicle} from "../../types/vehicle";

const VehicleStatusBadge = ({vehicle}: {vehicle: Vehicle}) => {

    const status = vehicle.status as keyof typeof VehicleStatusEnum;

    const statusColorMap: Record<string, string> = {
        [VehicleStatusEnum.available]: "teal",
        [VehicleStatusEnum.rented]: "red",
        [VehicleStatusEnum.maintenance]: "orange",
    }

    const statusTextMap: Record<string,string> = {
        [VehicleStatusEnum.available]: "Disponible",
        [VehicleStatusEnum.rented]: "A disposition",
        [VehicleStatusEnum.maintenance]: "Maintenance",
    }

    const tooltipTextMap: Record<string, string> = {
        [VehicleStatusEnum.available]: "Véhicule disponible",
        [VehicleStatusEnum.rented]: "Véhicule à disposition",
        [VehicleStatusEnum.maintenance]: "Véhicule en maintenance",
    }

    return <Tooltip label={tooltipTextMap[status]}><Badge color={statusColorMap[status]}>{statusTextMap[status]}</Badge></Tooltip>
}

export default VehicleStatusBadge;