import {Loader, Select, SelectProps} from "@mantine/core";
import {Parking} from "../../types/vehicle";
import {useList, HttpError, CrudFilters} from "@refinedev/core";
import React, {useEffect} from "react";

type ParkingSelectProps = Omit<SelectProps, "onChange" | "data" | "value"> & {onChange: (value: Parking | undefined) => void, value?: Parking, withLabel?: boolean, filters?: CrudFilters};
const ParkingSelect = ({onChange, value, withLabel, filters, ...otherProps}:ParkingSelectProps) => {

    const [selectValue, setSelectValue] = React.useState<string | undefined>(value?.id.toString());

    useEffect(() => {
        setSelectValue(value?.id.toString());
    }, [value]);

    const { data, isLoading, isError } = useList<Parking, HttpError>({
        resource: "parking",
        filters: filters || [],
    });

    const parkings = data?.data || [];

    useEffect(() => {
        //Check if the value is still in the parkings list
        if(value && !parkings.find((parking) => parking.id.toString() === selectValue)){
            handleChange(null);
        }
    }, [parkings]);

    //Map parkings to options for select component: {value: parking, label: parking}
    const options = parkings.map((parking) => ({key: parking.id, value:parking.id.toString(), label: parking.name}));

    const handleChange = (value: string|null) => {
        if(value === null){
            setSelectValue(undefined);
            onChange(undefined);
            return;
        }
        //Get the parking object from the options
        const parking = parkings.find((parking) => parking.id.toString() === value);
        if(!parking){
            return
        }
        onChange(parking);
        setSelectValue(value);
    }

    return (
        <Select label={withLabel && "Emplacement de stationnement:" } onChange={handleChange} value={selectValue} data={options}  rightSection={isLoading ? <Loader  size="xs" variant="bars"/>: undefined} {...otherProps}/>
    )
}

export default ParkingSelect;