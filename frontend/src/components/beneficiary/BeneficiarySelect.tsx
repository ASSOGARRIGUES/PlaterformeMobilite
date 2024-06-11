import {Loader, Select} from "@mantine/core"
import {useList} from "@refinedev/core";
import {Beneficiary} from "../../types/beneficiary";
import {humanizeFirstName, humanizeLastName} from "../../constants";
import React, {useState} from "react";
import {SelectProps} from "@mantine/core/lib/Select/Select";
import {useDebouncedValue} from "@mantine/hooks";


const BeneficiarySelect = ({ value, onChange, onChangeCompleteBeneficiary, ...otherProps }: Omit<SelectProps, "data"> & {onChangeCompleteBeneficiary?: (beneficiry: Beneficiary) => any}) => {

    const [search, setSearch] = useState("")
    const [searchDebounced] = useDebouncedValue(search, 300)


    const {data, isFetching} = useList<Beneficiary>({
        resource: "beneficiary",
        pagination: {pageSize: 30},
        filters: [
            {
                field: "search",
                operator: "eq",
                value:searchDebounced,
            },
        ]
    })

    const beneficiaryOptions = data?.data.map((beneficiary) => ({
        value: beneficiary.id.toString(),
        label: humanizeFirstName(beneficiary.first_name)+" "+humanizeLastName(beneficiary.last_name),
    })) || []

    const onChangeHandler = (value: string) => {
        if(onChange) onChange(value)
        const beneficiary = data?.data.find((beneficiary) => beneficiary.id.toString() === value)
        if(beneficiary && onChangeCompleteBeneficiary) onChangeCompleteBeneficiary(beneficiary)
    }


    return (
        <Select
            styles={{dropdown:{position:"fixed" }}}
            label="Bénéficiaire"
            value={value?.toString()}
            onChange={onChangeHandler}
            data={beneficiaryOptions}
            searchable
            clearable
            searchValue={search}
            onSearchChange={setSearch}
            rightSection={isFetching ? <Loader  size="xs" variant="bars"/>: undefined}
            {...otherProps}
        />
    )
}

export default BeneficiarySelect