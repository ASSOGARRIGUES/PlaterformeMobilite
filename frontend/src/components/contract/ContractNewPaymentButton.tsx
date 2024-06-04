import {IconReceiptEuro} from "@tabler/icons-react";
import {Button, Tooltip} from "@mantine/core";
import {Contract} from "../../types/contract";
import {ContractStatusEnum} from "../../types/schema.d";
import usePaymentModalForm from "../../hooks/contract/usePaymentModalForm";
import PaymentModal from "./PaymentModal";

const ContractNewPaymentButton = ({contract}: {contract: Contract}) => {

    const createModalForm = usePaymentModalForm({contract, action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    return (
        <>
            <PaymentModal {...createModalForm}/>

            <Tooltip label="Il est impossible d'ajouter un paiment à un contrat entièrement payé." disabled={!(contract.status==ContractStatusEnum.payed || contract.archived)}>
            <span style={{flex:"auto"}}>
                <Button
                    variant="light"
                    size="md"
                    radius="md"
                    leftIcon={<IconReceiptEuro size={18} />}
                    disabled={contract.status==ContractStatusEnum.payed || contract.archived}
                    onClick={() => {
                        showCreateModal()
                    }}
                >
                    Nouveau paiement
                </Button>
            </span>
            </Tooltip>
        </>
    )
}

export default ContractNewPaymentButton;