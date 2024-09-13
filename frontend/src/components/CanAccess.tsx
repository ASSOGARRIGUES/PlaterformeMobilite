import useAccessControl from "../hooks/useAccessControl";
import {ReactNode} from "react";
import {PermissionType} from "../types/PermissionType";

const CanAccess = ({permKey, children}: {permKey:PermissionType | PermissionType[], children: ReactNode}) => {
    const { isAuthorized } = useAccessControl();

    if (isAuthorized(permKey)) {
        return <>{children}</>;
    }

    return null;

}

export default CanAccess;
