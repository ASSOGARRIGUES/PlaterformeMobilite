import {Group, Loader, OptionsFilter, Select, SelectProps, Text} from "@mantine/core"
import {CrudFilters, useList} from "@refinedev/core";
import {humanizeFirstName, humanizeLastName} from "../../constants";
import React, {forwardRef, useState} from "react";
import {useDebouncedValue} from "@mantine/hooks";
import {Vehicle} from "../../types/vehicle";
import VehicleAvatar from "./VehicleAvatar";
import {ComboboxItem, ComboboxLikeRenderOptionInput} from "@mantine/core/lib/components/Combobox";

interface VehicleSelectItem extends React.ComponentPropsWithoutRef<'div'>  {
    value: string;
    label: string,
    vehicle: Vehicle
}

const VehicleSelect = ({ value, onChange, filters, onChangeCompleteVehicle, ...otherProps }: Omit<SelectProps, "data"> & {filters?:CrudFilters, onChangeCompleteVehicle?: (vehicle: Vehicle | undefined) => any}) => {

    const [search, setSearch] = useState("")
    const [searchDebounced] = useDebouncedValue(search, 300)

    const onChangeHandler = (value: string | null, option: ComboboxItem) => {
        if(onChange) onChange(value, option)
        const vehicle = vehicleOptions.find((vehicle) => vehicle.value === value)?.vehicle
        if(onChangeCompleteVehicle) onChangeCompleteVehicle(vehicle)
    }

    const {data, isFetching} = useList<Vehicle>({
        resource: "vehicle",
        pagination: {pageSize: 30},
        filters: [
            {
                field: "search",
                operator: "eq",
                value:searchDebounced,
            },
            ...(filters || [])
        ]
    })

    const vehicleOptions = data?.data.map((vehicle) => ({
        value: vehicle.id.toString(),
        label: vehicle.fleet_id.toString() + " " +vehicle.brand + " " + vehicle.modele + " " + (vehicle.color ?? ""),
        vehicle: vehicle,
    })) || []


    const renderSelectOption: SelectProps['renderOption']  = ({ option, checked }) => {
        const vehicle = (option as typeof vehicleOptions[number]).vehicle
        return (
            <Group >
                <VehicleAvatar vehicle={vehicle} size={35}/>

                <div>
                    <Text size="sm">{`${vehicle.fleet_id} - ${vehicle.brand} ${vehicle.modele} ${vehicle.color ?? ""}`}</Text>
                    <Text size="xs" opacity={0.65}>
                        {vehicle.imat}
                    </Text>
                </div>
            </Group>
        )};


    // Filtering is done on the backend --> optionsFilter just returns the options
    const optionsFilter: OptionsFilter = ({ options, search }) => {
        return options
    };
    return (
        <Select
            styles={{dropdown:{position:"fixed" }}}
            label="Véhicule"
            value={value?.toString()}
            onChange={onChangeHandler}
            data={vehicleOptions}
            searchable
            clearable
            searchValue={search}
            maxDropdownHeight={400}
            onSearchChange={setSearch}
            rightSection={isFetching ? <Loader  size="xs" type="bars"/>: undefined}
            renderOption={renderSelectOption}
            filter={optionsFilter}
            {...otherProps}
        />
    )
}

export default VehicleSelect