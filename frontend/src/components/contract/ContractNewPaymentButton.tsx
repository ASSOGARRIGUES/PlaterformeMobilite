import {IconCoins, IconCurrencyEuro, IconReceiptEuro} from "@tabler/icons-react";
import {ActionIcon, Button, Tooltip} from "@mantine/core";
import {Contract} from "../../types/contract";
import {ContractStatusEnum} from "../../types/schema.d";
import usePaymentModalForm from "../../hooks/contract/usePaymentModalForm";
import PaymentModal from "./PaymentModal";

type ContractButtonVariant = "icon" | "button"
const ContractNewPaymentButton = ({contract, variant="icon"}: {contract: Contract, variant?:ContractButtonVariant}) => {

    const createModalForm = usePaymentModalForm({contract, action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    let content = (<></>);

    const disabled = contract.status==ContractStatusEnum.payed || contract.archived

    if(variant === "button") {
        content = (
            <Button
                variant="light"
                size="md"
                radius="md"
                leftSection={<IconCoins size={18} />}
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    showCreateModal();
                }}
            >
                Nouveau paiement
            </Button>
        )
    }else{
        content = (
            <ActionIcon
                variant="subtle"
                style={{width:"100%"}}
                color="blue"
                disabled={disabled}
                onClick={(e)=>{e.stopPropagation(); showCreateModal()}}
            >
                <IconCoins color="black" style={{width:29, height:"auto", backgroundColor: "rgba(1,1,1,0)"}} />
            </ActionIcon>
        )
    }

    const tooltipLabel = disabled ? "Il est impossible d'ajouter un paiment à un contrat entièrement payé." : "Enregistrer un nouveau paiement"

    return (
        <>
            <PaymentModal {...createModalForm}/>

            <Tooltip label={tooltipLabel}>
            <span>
                {content}
            </span>
            </Tooltip>
        </>
    )
}

export default ContractNewPaymentButton;