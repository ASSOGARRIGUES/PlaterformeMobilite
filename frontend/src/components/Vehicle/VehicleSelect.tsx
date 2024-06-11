import {Group, Loader, Select, Text} from "@mantine/core"
import {CrudFilters, useList} from "@refinedev/core";
import {humanizeFirstName, humanizeLastName} from "../../constants";
import React, {forwardRef, useState} from "react";
import {SelectProps} from "@mantine/core/lib/Select/Select";
import {useDebouncedValue} from "@mantine/hooks";
import {Vehicle} from "../../types/vehicle";
import VehicleAvatar from "./VehicleAvatar";

interface VehicleSelectItem extends React.ComponentPropsWithoutRef<'div'>  {
    value: string;
    label: string,
    vehicle: Vehicle
}

const VehicleSelect = ({ value, onChange, filters, onChangeCompleteVehicle, ...otherProps }: Omit<SelectProps, "data"> & {filters?:CrudFilters, onChangeCompleteVehicle?: (vehicle: Vehicle) => any}) => {

    const [search, setSearch] = useState("")
    const [searchDebounced] = useDebouncedValue(search, 300)

    const SelectItem = forwardRef<HTMLDivElement, VehicleSelectItem>(
        ({ value, label, vehicle, ...otherProps }: VehicleSelectItem, ref) => (
            <div ref={ref} {...otherProps}>
                <Group noWrap >
                    <VehicleAvatar vehicle={vehicle} size={35}/>

                    <div>
                        <Text size="sm">{`${vehicle.fleet_id} - ${vehicle.brand} ${vehicle.modele} ${vehicle.color ?? ""}`}</Text>
                        <Text size="xs" opacity={0.65}>
                            {vehicle.imat}
                        </Text>
                    </div>
                </Group>
            </div>
        )
    );

    const onChangeHandler = (value: string) => {
        if(onChange) onChange(value)
        const vehicle = vehicleOptions.find((vehicle) => vehicle.value === value)?.vehicle
        if(vehicle && onChangeCompleteVehicle) onChangeCompleteVehicle(vehicle)
    }


    const {data, isLoading} = useList<Vehicle>({
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
            dropdownPosition={"flip"}
            onSearchChange={setSearch}
            rightSection={isLoading ? <Loader  size="xs" variant="bars"/>: undefined}
            itemComponent={SelectItem}
            filter={(value, item) => item.label?.toLowerCase().includes(value.toLowerCase().trim()) || item.vehicle.imat?.toLowerCase().includes(value.toLowerCase().trim())}
            {...otherProps}
        />
    )
}

export default VehicleSelect