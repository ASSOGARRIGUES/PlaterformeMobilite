import {useApiUrl, useCustom} from "@refinedev/core";
import {Contract, ContractPaymentSummary} from "../../types/contract";


const usePaymentSummary = ({contract}: {contract: Contract}) => {

    const apiUrl = useApiUrl()

    const {data, ...otherProps} = useCustom<ContractPaymentSummary>({
        url: `${apiUrl}/contract/${contract.id}/payment/summary`,
        method: "get",
        queryOptions: {
            queryKey: ["contract-payment-summary"],
        }
    })

    return {data:data?.data, ...otherProps};
}

export default usePaymentSummary;
