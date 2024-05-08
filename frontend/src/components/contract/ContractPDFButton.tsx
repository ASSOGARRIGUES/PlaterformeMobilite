import {CompleteContract, Contract} from "../../types/contract";
import {ActionIcon, Button, Tooltip} from "@mantine/core";
import ContractIcon from "../../assets/contract.svg";
import {useApiUrl, useResource} from "@refinedev/core";

type ContractButtonVariant = "icon" | "button"

const ContractPDFButton = ({contract, variant="icon"}: {contract: Contract | CompleteContract, variant?:ContractButtonVariant}) => {

    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

    let content = (<></>);

    if (variant === "button") {
        content = (
            <Button
                component = "a"
                href = {`${apiUrl}/${resource}/${contract.id}/get_contract_pdf/`}
                target = "_blank"
                variant="outline"
            >
                 <img src = {ContractIcon} width="20px" style={{marginRight: 5}}/> Télécharger le contrat
            </Button>
        )
    }else {
        content = (
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

    return (
        <Tooltip label={"Télécharger le contrat"} position="bottom" openDelay={200}>
            {content}
        </Tooltip>
    )

}

export default ContractPDFButton;
