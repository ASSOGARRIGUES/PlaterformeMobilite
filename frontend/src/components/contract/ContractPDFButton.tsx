import {CompleteContract, Contract} from "../../types/contract";
import {ActionIcon, Button, Tooltip} from "@mantine/core";
import ContractIcon from "../../assets/contract.svg";
import {useApiUrl, useResource} from "@refinedev/core";
import {axiosInstance} from "../../providers/rest-data-provider/utils";
import {downloadInBrowser, openPdfInNewTab} from "../../constants";

type ContractButtonVariant = "icon" | "button"

const ContractPDFButton = ({contract, variant="icon"}: {contract: Contract | CompleteContract, variant?:ContractButtonVariant}) => {

    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

    let content = (<></>);

    async function openPDF() {
        openPdfInNewTab(`${apiUrl}/${resource}/${contract.id}/get_contract_pdf/`)
    }

    if (variant === "button") {
        content = (
            <Button
                variant="outline"
                onClick={(e)=>{e.stopPropagation(); openPDF()}}
            >
                 <img src = {ContractIcon} width="20px" style={{marginRight: 5}}/> Télécharger le contrat
            </Button>
        )
    }else {
        content = (
             <ActionIcon
                color = "blue"
                onClick={(e)=>{e.stopPropagation(); openPDF()}}
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
