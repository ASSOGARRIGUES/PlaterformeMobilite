import {CompleteContract, Contract} from "../../types/contract";
import {ActionIcon, Button, Tooltip} from "@mantine/core";
import {useApiUrl, useResource} from "@refinedev/core";
import {IconCurrencyEuro} from "@tabler/icons-react";
import {ContractStatusEnum} from "../../types/schema.d";
import {openPdfInNewTab} from "../../constants";

type ContractButtonVariant = "icon" | "button"
const BillPDFButton = ({contract, variant="icon"}: {contract: Contract | CompleteContract, variant?:ContractButtonVariant}) => {

    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

        async function openPDF() {
        openPdfInNewTab(`${apiUrl}/${resource}/${contract.id}/get_bill_pdf/`)
    }

    let content = (<></>);

    const disabled = (contract.status !== ContractStatusEnum.over && contract.status !== ContractStatusEnum.payed);

    if(variant === "button") {
        content = (
            <Button
                style={{width:"100%"}}
                variant="outline"
                disabled={disabled}
                onClick={(e)=>{e.stopPropagation(); openPDF()}}
            >
                <IconCurrencyEuro color="black" style={{width:20, height:"auto", marginRight:5}} /> Télécharger la facture
            </Button>
        )
    }else{
        content = (
            <ActionIcon
                style={{width:"100%"}}
                color="blue"
                disabled={disabled}
                onClick={(e)=>{e.stopPropagation(); openPDF()}}
            >
                <IconCurrencyEuro color="black" style={{width:29, height:"auto", backgroundColor: "rgba(1,1,1,0)"}} />
            </ActionIcon>
        )
    }

    return (
        <Tooltip label={disabled ? "Le contrat doit être clôturé pour télécharger la facture" : "Télécharger la facture"} position="bottom" openDelay={200}>
            <span>
                {content}
            </span>
        </Tooltip>
    )

}

export default BillPDFButton;
