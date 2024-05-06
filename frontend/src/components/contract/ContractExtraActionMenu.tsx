import {Contract} from "../../types/contract";
import {ActionIcon, Menu, Text} from "@mantine/core";
import {IconDots} from "@tabler/icons-react";
import {ContractStatusEnum} from "../../types/schema.d";
import {useApiUrl, useResource, useInvalidate} from "@refinedev/core";
import {openConfirmModal} from "@mantine/modals";
import {axiosInstance} from "../../providers/rest-data-provider/utils";

const ContractExtraActionMenu = ({contract, showEndModal}: {contract: Contract,showEndModal: (id: number)=>any}) => {

    const apiUrl = useApiUrl();
    const {resource} = useResource()

    const invalidate = useInvalidate()


    const handlePayContract = async () => {

        openConfirmModal({
            title: "Marquer le contrat comme payé",
            children: (
                <Text>Êtes-vous certain de vouloir marquer ce contrat comme payé ?</Text>
            ),
            labels: {confirm: "Oui", cancel: "Non"},
            onConfirm: async () => {
                await axiosInstance["post"](`${apiUrl}/${resource?.name}/${contract.id}/payed/`)
                invalidate({
                    resource: resource?.name,
                    invalidates: ["detail", "list"],
                    id: contract.id
                })
            }
        });

    };

    const endContractItem = (
        <Menu.Item onClick={() => {showEndModal(contract.id)}}>
            Clôturer
        </Menu.Item>
    )

    const payContractItem = (
        <Menu.Item onClick={handlePayContract}>
            Marquer comme payé
        </Menu.Item>
    )

    const getContractPDFItem = (
        <Menu.Item component="a" href={`${apiUrl}/${resource?.name}/${contract.id}/get_contract_pdf/`} target="_blank">
            Télécharger le contrat
        </Menu.Item>
    )


    return (
        <Menu>
            <Menu.Target>
                <ActionIcon color="blue">
                    <IconDots size={25} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                {contract.status === ContractStatusEnum.over || contract.status === ContractStatusEnum.payed ? getContractPDFItem : endContractItem}
                {contract.status === ContractStatusEnum.over ? payContractItem : ""}
            </Menu.Dropdown>
        </Menu>
    )
}

export default ContractExtraActionMenu;