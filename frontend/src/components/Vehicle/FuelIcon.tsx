import {FuelTypeEnum} from "../../types/schema.d";

const FuelIcon = ({ fuel }: { fuel: FuelTypeEnum }) => {
    return (
        <div>
            {fuel === FuelTypeEnum.diesel && <span>Diesel</span>}
            {fuel === FuelTypeEnum.essence && <span>Essence</span>}
            {fuel === FuelTypeEnum.electrique && <span>Electrique</span>}
        </div>
    );
}

export default FuelIcon;