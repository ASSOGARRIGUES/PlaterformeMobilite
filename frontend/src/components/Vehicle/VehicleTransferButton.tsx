import {useGo} from "@refinedev/core";
import {Vehicle} from "../../types/vehicle";
import {Button} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";
import CanAccess from "../CanAccess";

const VehicleTransferButton = ({vehicle} : {vehicle: Vehicle | undefined}) => {

    const go = useGo();

    if (!vehicle) return null;

    return (
        <CanAccess permKey={"api.can_transfer_vehicle"}>
            <Button
                onClick={() => go({to:`/vehicle/${vehicle.id}/transfer/`})}
                color="blue"
                disabled={vehicle.status === VehicleStatusEnum.rented}
            >
                Transférer
            </Button>
        </CanAccess>
    )

}

export default VehicleTransferButton;