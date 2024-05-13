import {FuelTypeEnum} from "../../types/schema.d";
import {fuelTypeLabelMap} from "../../constants";
import {Tooltip} from "@mantine/core";
import {IconBolt, IconGasStation} from "@tabler/icons-react";

const FuelIcon = ({ fuel }: { fuel: FuelTypeEnum }) => {

    const letter = fuel === FuelTypeEnum.diesel ? "D" : "E";

    const iconGas = (
        <div>
            <IconGasStation/>
            <span>{letter}</span>
        </div>
    )

    const icon = fuel === FuelTypeEnum.electrique ? <IconBolt/> : iconGas;
    const tooltip = fuelTypeLabelMap[fuel];

    return (
        <Tooltip label={tooltip} position="bottom" openDelay={200}>
            {icon}
        </Tooltip>
    );
}

export default FuelIcon;