import {Button, Text} from "@mantine/core";
import {BaseKey, useDelete, useGo} from "@refinedev/core";
import {Contract} from "../../types/contract";
import CanAccess from "../CanAccess";
import {openConfirmModal} from "@mantine/modals";

const ContractDeleteButton = ({ contract }: { contract: Contract | undefined }) => {

    const { mutate } = useDelete();
    const go = useGo();


    if (!contract) return null;

    //Check if the contract has been created more than 15 minutes ago
    //If yes, don't show the button
    const creationDate = new Date(contract.created_at);
    const now = new Date();
    const diff = now.getTime() - creationDate.getTime();
    const diffMinutes = diff / (1000 * 60);
    if (diffMinutes > 15) {
        return null;
    }

    const askForConfirmation = () => {
        //Show a confirmation dialog
        //If the user confirms, delete
        //If the user cancels, do nothing

        openConfirmModal({
            title: "Supprimer le contrat",
            children: (
                <Text size="sm">
                    Êtes-vous sûr de vouloir supprimer ce contrat ? <br/>
                    Cette action est <b><u>irréversible</u></b>.
                </Text>
            ),
            labels: {confirm: "Supprimer", cancel: "Annuler"},
            confirmProps: {color: "red"},
            onConfirm: () => {
                //Delete the contract
                mutate({
                    resource: "contract",
                    id: contract.id
                }, {
                    onSuccess: () => {
                        go({to: "/contract"})
                    }
                });
            }
        })
    }

    return (
        <CanAccess permKey={"api.delete_contract"}>
            <Button
                color="red"
                onClick={askForConfirmation}
            >
                Supprimer
            </Button>
        </CanAccess>
    )
}

export default ContractDeleteButton;