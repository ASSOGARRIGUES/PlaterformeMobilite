import {CompleteContract} from "../../types/contract";
import {Beneficiary} from "../../types/beneficiary";
import {Vehicle} from "../../types/vehicle";
import {capitalizeFirstLetter} from "../../constants";
import BeneficiaryBadge from "../beneficiary/BeneficiaryBadge";
import VehicleBadge from "../Vehicle/VehicleBadge";

const ContractBadge = ({ contract }: { contract: CompleteContract | undefined }) => {
    if (!contract) {
        return (
            <span>"loading ..."</span>
        );
    }

    if(!contract.beneficiary?.hasOwnProperty("id") || !contract.vehicle?.hasOwnProperty("id")){
        return (
            <span> {contract.id} </span>
        )
    }

    const beneficiary = contract.beneficiary as Beneficiary
    const vehicle = contract.vehicle as Vehicle

    return (
        <span> #{contract.id} - <BeneficiaryBadge beneficiary={beneficiary}/> <VehicleBadge vehicle={vehicle}/> </span>
    )


}

export default ContractBadge;