import { useUserActions } from "../../context/UserActionsProvider";
import ActionSelect from "./ActionSelect";

const ActionSelector = () => {

    //Use the user action context to get the user actions
    const userActions = useUserActions();

    if (!userActions?.actions || userActions.actions.length<2) { // if the user have access to less than 2 actions, don't show the selector
        return (<></>);
    }

    return (
        <ActionSelect
            onChange={(value) => {
                if(!value) return;
                userActions.changeCurrentAction(value?.id);}
            }
            value={userActions.current_action}
        />

    );
}

export default ActionSelector;