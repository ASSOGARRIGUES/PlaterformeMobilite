import {createContext, useContext} from "react";
import {BugReporterContextType} from "./BugReporterProvider";
import {WhoAmI} from "../types/auth";

export type AccessControlProviderType = {
    identity: WhoAmI;
}

const AccessControlProviderContext = createContext<AccessControlProviderType | null>(null);

const useAccessControl = () => {
    const context = useContext(AccessControlProviderContext) as AccessControlProviderType;

    if(!context) {
        throw new Error("useAccessControl must be used within a AccessControlProvider");
    }

    return context;
}

const AccessControlProvider = ({children} : {children: React.ReactNode}) => {

    return (
        <AccessControlProviderContext.Provider value={{identity: null}}>
            {children}
        </AccessControlProviderContext.Provider>
    )
}