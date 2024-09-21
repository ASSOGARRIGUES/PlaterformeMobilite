import {UserActions} from "../types/actions";
import {createContext, useContext} from "react";
import {useApiUrl, useCustom, useCustomMutation, useInvalidate} from "@refinedev/core";
import {useQueryClient} from "@tanstack/react-query";

type SelectiveOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type UserActionsContextType = SelectiveOptional<UserActions, "current_action"> & {changeCurrentAction: (actionId: number) => void, isFetching: boolean};

const UserActionsContext = createContext<UserActionsContextType | null>(null);

const useUserActions = () => {
    const context = useContext(UserActionsContext) as UserActionsContextType;

    if(!context) {
        throw new Error("useUserActions must be used within a UserActionsProvider");
    }

    return context;
}


const UserActionsProvider = ({children} : {children: React.ReactNode}) => {
    const apiUrl = useApiUrl();

    const {data, refetch, isFetching} = useCustom<UserActions>({
        url: `${apiUrl}/user-actions/`,
        method: "get",
        queryOptions: {
            staleTime: 10*60*1000, // 10 minutes --> the data will be considered stale after 5 minutes and will be refetched
            refetchInterval: 10*60*1000, // Force refetch every 10 min.
        }
    })

    const userActions = data?.data || {actions: [], current_action: undefined};

    const {mutate} = useCustomMutation();
    const invalidate = useInvalidate();

    const changeCurrentAction = (actionId: number) => {
        // Send a POST request to the server to change the current action
        mutate({
                url: `${apiUrl}/user-actions/`,
                method: "post",
                values: {
                    current_action: actionId
                }
            },
            {
                onSuccess: () => {
                    refetch();

                    invalidate({
                        resource: "contract",
                        invalidates: ["all"]
                    })

                    invalidate({
                        resource: "beneficiary",
                        invalidates: ["all"]
                    })

                    invalidate({
                        resource: "vehicle",
                        invalidates: ["all"]
                    })

                }
            })

    }

    return (
        <UserActionsContext.Provider value={{...userActions, changeCurrentAction, isFetching: isFetching}}>
            {children}
        </UserActionsContext.Provider>
    )
}

export {UserActionsProvider, useUserActions, UserActionsContext};