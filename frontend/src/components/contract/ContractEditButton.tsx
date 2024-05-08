import EditButton, {EditButtonProps} from "../EditButton";
import {ContractStatusEnum} from "../../types/schema.d";
import {CompleteContract, Contract} from "../../types/contract";

const ContractEditButton = ({contract, ...editProps}: {contract: Contract | CompleteContract} & Omit<EditButtonProps, "record">) => {
    return (
        <EditButton record={contract} {...editProps} disabled={contract.status === ContractStatusEnum.over || contract.status === ContractStatusEnum.payed} />
    )
}

export default ContractEditButton;