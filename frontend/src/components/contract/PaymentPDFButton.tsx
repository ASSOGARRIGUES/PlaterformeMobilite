import {Contract, Payment} from "../../types/contract";
import {useApiUrl, useResource} from "@refinedev/core";
import {openPdfInNewTab} from "../../constants";
import {IconCurrencyEuro, IconFileEuro} from "@tabler/icons-react";
import {ActionIcon, Tooltip} from "@mantine/core";

const PaymentPDFButton = ({contract, payment}: {contract: Contract, payment: Payment}) => {
    const apiUrl = useApiUrl();
    const {select} = useResource()
    const resource = select("contract").identifier

    async function openPDF() {
        openPdfInNewTab(`${apiUrl}/${resource}/${contract.id}/payment/${payment.id}/get_participation_pdf/`)
    }

    return (
        <Tooltip label={"Télécharger le bulletin de participation"} position="bottom" openDelay={200}>
            <ActionIcon
                color="blue"
                onClick={(e)=>{e.stopPropagation(); openPDF()}}
            >
                <IconFileEuro color="black" style={{width:29, height:"auto", backgroundColor: "rgba(1,1,1,0)"}} />
            </ActionIcon>
        </Tooltip>
    )
}

export default PaymentPDFButton;