import {BaseKey, useApiUrl, useInvalidate, useResource} from "@refinedev/core";
import {openConfirmModal} from "@mantine/modals";
import {Text} from "@mantine/core";
import {axiosInstance} from "../../providers/rest-data-provider/utils";

const usePayContract = () => {
    const apiUrl = useApiUrl();
    const {resource} = useResource()

    const invalidate = useInvalidate()


    const handlePayContract = async (contract_id: BaseKey) => {

        await axiosInstance["post"](`${apiUrl}/${resource?.name}/${contract_id}/payed/`)
        invalidate({
            resource: resource?.name,
            invalidates: ["detail", "list"],
            id: contract_id
        })

    };

    return {handlePayContract}
}

export default usePayContract;
