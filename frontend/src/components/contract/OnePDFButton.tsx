import {Contract} from "../../types/contract";
import {ContractStatusEnum} from "../../types/schema.d";
import BillPDFButton from "./BillPDFButton";
import ContractPDFButton from "./ContractPDFButton";

const OnePDFButton = ({contract}: {contract: Contract}) => {
    return (
        contract.status === ContractStatusEnum.over ||  contract.status === ContractStatusEnum.payed ? <BillPDFButton contract={contract}/> : <ContractPDFButton contract={contract}/>
    )
}

export default OnePDFButton;