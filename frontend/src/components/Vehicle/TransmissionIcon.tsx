import {IconAutomaticGearbox, IconManualGearbox} from "@tabler/icons-react";
import {TransmissionEnum} from "../../types/schema.d";
import {Tooltip} from "@mantine/core";

const TransmissionIcon = ({ transmission }: { transmission: TransmissionEnum }) => {

    const icon = transmission === TransmissionEnum.automatique ? (<IconAutomaticGearbox/>) : (<IconManualGearbox/>);

    const tooltip = transmission === TransmissionEnum.automatique ? "Automatique" : "Manuelle";

    return (
        <Tooltip label={tooltip} position="bottom" openDelay={200}>
            {icon}
        </Tooltip>
    )

}

export default TransmissionIcon;