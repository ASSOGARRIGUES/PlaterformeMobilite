import {
    AccessControlProvider,
    CanParams,
    IAccessControlContext,
    useApiUrl,
    useCustom,
    useGetIdentity
} from "@refinedev/core";
import {CanResponse} from "@refinedev/core/dist/contexts/accessControl/types";

const useAccessControl = () => {

       const apiUrl = useApiUrl();

        const {data: identity} = useCustom({
            url: `${apiUrl}/identity/`,
            method: "get",
        });

  const accessControlProvider: AccessControlProvider = {
    can: async ({
                  resource,
                  action,
                  params,
                }: CanParams): Promise<CanResponse> => {




      return { can: true };
    },
    options: {
      buttons: {
        enableAccessControl: true,
        hideIfUnauthorized: false,
      },
      queryOptions: {
        // ... default global query options
      },
    },
  }

  return { accessControlProvider };
}



export default useAccessControl;
