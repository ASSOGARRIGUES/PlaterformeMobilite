import {Contract} from "../../types/contract";
import {ActionIcon, Menu} from "@mantine/core";
import {IconDots} from "@tabler/icons-react";
import {ContractStatusEnum} from "../../types/schema.d";
import {useApiUrl, useResource} from "@refinedev/core";

const ContractExtraActionMenu = ({contract, showEndModal}: {contract: Contract,showEndModal: (id: number)=>any}) => {

    const apiUrl = useApiUrl();
    const {resource} = useResource()

    const endContractItem = (
        <Menu.Item onClick={() => {showEndModal(contract.id)}}>
            Clôturer
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
            </Menu.Dropdown>
        </Menu>
    )
}

export default ContractExtraActionMenu;