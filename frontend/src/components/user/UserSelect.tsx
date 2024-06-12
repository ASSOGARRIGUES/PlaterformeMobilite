import {Loader, Select} from "@mantine/core"
import {CrudFilters, useList} from "@refinedev/core";
import {humanizeFirstName, humanizeLastName} from "../../constants";
import React, {useState} from "react";
import {SelectProps} from "@mantine/core/lib/Select/Select";
import {useDebouncedValue} from "@mantine/hooks";
import {User} from "../../types/auth";


const ReferentSelect = ({ value, onChange, filters, onChangeCompleteReferent, ...otherProps }: Omit<SelectProps, "data"> & {filters?:CrudFilters, onChangeCompleteReferent?:(referent: User)=>any}) => {

    const [search, setSearch] = useState("")
    const [searchDebounced] = useDebouncedValue(search, 300)



    const {data, isLoading} = useList<User>({
        resource: "referent",
        pagination: {pageSize: 10},
        filters: [
            {
                field: "search",
                operator: "eq",
                value:searchDebounced,
            },
            ...(filters || [])
        ]
    })

    const referentOptions = data?.data.map((referent) => ({
        value: referent.id.toString(),
        label: humanizeFirstName(referent.first_name)+" "+humanizeLastName(referent.last_name),
    })) || []

    const onChangeHandler = (value: string) => {
        if(onChange) onChange(value)
        const referent = data?.data.find((referent) => referent.id.toString() === value)
        if(referent && onChangeCompleteReferent) onChangeCompleteReferent(referent)
    }

    return (
        <Select
            styles={{dropdown:{position:"fixed" }}}
            label="Référent"
            value={value?.toString()}
            onChange={onChangeHandler}
            data={referentOptions}
            searchable
            clearable
            searchValue={search}
            onSearchChange={setSearch}
            rightSection={isLoading ? <Loader  size="xs" variant="bars"/>: undefined}
            {...otherProps}
        />
    )
}

export default ReferentSelect