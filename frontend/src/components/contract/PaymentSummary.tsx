import {Contract, ContractPaymentSummary} from "../../types/contract";
import {useApiUrl, useCustom} from "@refinedev/core";
import {Skeleton} from "@mantine/core";
import usePaymentSummary from "../../hooks/contract/usePaymentSummary";

const PaymentSummary = ({contract}: {contract: Contract}) => {


    const {data, isLoading} = usePaymentSummary({contract})

    const remaining = data?.total_due && data?.payments_sum ?  data?.total_due - data?.payments_sum : "---"

    if (isLoading) return <Skeleton height={50} />

    return (
        <table>
            <tbody>
            <tr>

                <td><b>Montant paiements</b></td>
                <td>{data?.payments_sum || "---"} €</td>
            </tr>
            <tr>
                <td><b>Montant dû</b></td>
                <td>{data?.total_due || "---"} €</td>
                <td><b>Reste à payer</b></td>
                <td style={{color:(remaining!=0 ? 'red': 'black')}}>{remaining} €</td>
            </tr>
            </tbody>
        </table>
    )


}

export default PaymentSummary;