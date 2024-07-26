import {useApiUrl, useCustom} from "@refinedev/core";
import {WhoAmI} from "../types/auth";
import {PermissionType} from "../types/PermissionType";

const useAccessControl = () => {

    const apiUrl = useApiUrl();

    const {data} = useCustom<WhoAmI>({
        url: `${apiUrl}/whoami/`,
        method: "get",
        queryOptions: {
            staleTime: 10*60*1000 // 10 minutes --> the data will be considered stale after 5 minutes and will be refetched
        }
    })

    const isAuthorized = (perm_key: PermissionType | PermissionType[]) => {
        if(perm_key === true) return true;

        // If perm_key is an array, check if the user has all the permissions in the array
        if(Array.isArray(perm_key)) {
            return perm_key.every((perm) => data?.data?.permissions?.includes(perm));
        }

        return data?.data?.permissions?.includes(perm_key);
    }

    return {isAuthorized};
}

export default useAccessControl;