import {Contract} from "../../types/contract";
import {ActionIcon} from "@mantine/core";
import ContractIcon from "../../assets/contract.svg";
import {useApiUrl, useResource} from "@refinedev/core";

const ContractPDFButton = ({contract}: {contract: Contract}) => {

    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

    return (
        <ActionIcon
            component = "a"
            href = {`${apiUrl}/${resource}/${contract.id}/get_contract_pdf/`}
            target = "_blank"
            color = "blue"
        >
            <img src = {ContractIcon}/>
        </ActionIcon>
    )

}

export default ContractPDFButton;
