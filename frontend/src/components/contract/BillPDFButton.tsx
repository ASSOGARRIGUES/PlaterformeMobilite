import {Contract} from "../../types/contract";
import {ActionIcon, Tooltip} from "@mantine/core";
import {useApiUrl, useResource} from "@refinedev/core";
import {IconCurrencyEuro} from "@tabler/icons-react";

const BillPDFButton = ({contract}: {contract: Contract}) => {

    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

    return (
        <Tooltip label={"Télécharger la facture"} position="bottom" openDelay={200}>
            <ActionIcon component="a" href={`${apiUrl}/${resource}/${contract.id}/get_bill_pdf/`} target="_blank" color="blue">
                <IconCurrencyEuro color="black" style={{width:29, height:"auto"}} />
            </ActionIcon>
        </Tooltip>
    )

}

export default BillPDFButton;
