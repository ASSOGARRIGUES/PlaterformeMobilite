import {Loader, Select, SelectProps} from "@mantine/core";
import {Parking} from "../../types/vehicle";
import {useList, HttpError, CrudFilters} from "@refinedev/core";
import React, {useEffect} from "react";
import {Action} from "../../types/actions";
import {useUserActions} from "../../context/UserActionsProvider";

type ActionSelectProps = Omit<SelectProps, "onChange" | "data" | "value"> & {onChange: (value: Action | undefined) => void, value?: Action, withLabel?: boolean, filters?: CrudFilters};
const ActionSelect = ({onChange, value, withLabel, filters, ...otherProps}:ActionSelectProps) => {

    const userActions = useUserActions();

    const [selectValue, setSelectValue] = React.useState<string | undefined>(value?.id.toString());

    useEffect(() => {
        setSelectValue(value?.id.toString());
    }, [value]);

        //Prepare data for select
    const options = userActions?.actions?.map((action) => {
        return {
            label: action.name,
            value: action.id.toString()
        }
    }) || [];

    const handleChange = (value: string|null) => {
        if(value === null){
            setSelectValue(undefined);
            onChange(undefined);
            return;
        }
        //Get the parking object from the options
        const action = userActions.actions.find((action) => action.id.toString() === value);
        if(!action){
            console.error("Parking not found");
            return
        }
        onChange(action);
        setSelectValue(value);
    }

    return (
        <Select
            label={withLabel && "Action:" }
            placeholder={"Selectionner une action"}

            onChange={handleChange}
            value={selectValue}
            data={options}
            rightSection={userActions.isFetching ? <Loader  size="xs" variant="bars"/>: undefined}
            disabled={userActions.isFetching}
            {...otherProps}
        />
    )
}

export default ActionSelect;