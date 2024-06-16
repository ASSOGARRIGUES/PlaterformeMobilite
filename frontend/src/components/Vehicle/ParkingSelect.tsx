import {Loader, Select, SelectProps} from "@mantine/core";
import {Parking} from "../../types/vehicle";
import { useList, HttpError } from "@refinedev/core";
import React, {useEffect} from "react";

type ParkingSelectProps = Omit<SelectProps, "onChange" | "data" | "value"> & {onChange: (value: Parking | undefined) => void, value?: Parking, withLabel?: boolean};
const ParkingSelect = ({onChange, value, withLabel, ...otherProps}:ParkingSelectProps) => {

    const [selectValue, setSelectValue] = React.useState<string | undefined>(value?.id.toString());

    useEffect(() => {
        setSelectValue(value?.id.toString());
    }, [value]);

    const { data, isLoading, isError } = useList<Parking, HttpError>({
        resource: "parking",
    });

    const parkings = data?.data || [];

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
            console.error("Parking not found");
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