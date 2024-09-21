import {useGo} from "@refinedev/core";
import {Vehicle} from "../../types/vehicle";
import {Button} from "@mantine/core";
import {VehicleStatusEnum} from "../../types/schema.d";
import CanAccess from "../CanAccess";
import {useUserActions} from "../../context/UserActionsProvider";

const VehicleTransferButton = ({vehicle} : {vehicle: Vehicle | undefined}) => {

    const go = useGo();

    const userActions = useUserActions();

    if (!vehicle) return null;
    if (userActions.actions.length < 2) return null; // if the user have access to less than 2 actions, don't show the transfer option

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