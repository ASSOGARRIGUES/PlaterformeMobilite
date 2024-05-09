import {CompleteContract, Contract} from "../../types/contract";
import {ActionIcon, Button, Text, Tooltip} from "@mantine/core";
import {useApiUrl, useResource} from "@refinedev/core";
import {IconCoins, IconCurrencyEuro} from "@tabler/icons-react";
import {ContractStatusEnum} from "../../types/schema.d";
import {openPdfInNewTab} from "../../constants";
import {openConfirmModal} from "@mantine/modals";
import usePayContract from "../../hooks/contract/usePayContract";

type ContractButtonVariant = "icon" | "button"
const PayedContractButton = ({contract, variant="icon"}: {contract: Contract | CompleteContract, variant?:ContractButtonVariant}) => {

    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

    const {handlePayContract} = usePayContract()

    const openModal = async () => {

        openConfirmModal({
            title: "Marquer le contrat comme payé",
            children: (
                <Text>Êtes-vous certain de vouloir marquer ce contrat comme payé ?</Text>
            ),
            labels: {confirm: "Oui", cancel: "Non"},
            onConfirm: () => {handlePayContract(contract.id)}
        });

    };

    let content = (<></>);

    const disabled = (contract.status !== ContractStatusEnum.over)

    if(variant === "button") {
        content = (
            <Button
                style={{width:"100%"}}
                variant="outline"
                disabled={disabled}
                onClick={(e)=>{e.stopPropagation(); openModal()}}
            >
                <IconCurrencyEuro color="black" style={{width:20, height:"auto", marginRight:5}} /> Marquer comme payé
            </Button>
        )
    }else{
        content = (
                <ActionIcon
                    style={{width:"100%"}}
                    color="blue"
                    disabled={disabled}
                    onClick={(e)=>{e.stopPropagation(); openModal()}}
                >
                    <IconCoins color="black" style={{width:29, height:"auto", backgroundColor: "rgba(1,1,1,0)"}} />
                </ActionIcon>
        )
    }

    return (
        <Tooltip label={"Marquer le contrat comme payé"} position="bottom" openDelay={200}>
            <span>
                {content}
            </span>
        </Tooltip>
    )

}

export default PayedContractButton;
