import {TransmissionEnum} from "../../types/schema.d";

const TransmissionIcon = ({ transmission }: { transmission: TransmissionEnum }) => {

    return (
        <div>
            {transmission === TransmissionEnum.automatique && <span>Auto</span>}
            {transmission === TransmissionEnum.manuelle && <span>Manuel</span>}
        </div>
    );

}

export default TransmissionIcon;