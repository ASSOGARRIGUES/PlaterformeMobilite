import {ColumnFilter} from "../../SearchableDataTable";
import {Contract} from "../../../types/contract";
import {Button, Stack} from "@mantine/core";
import {DatePicker, DateValue} from "@mantine/dates";
import {DatesRangeValue} from "@mantine/dates/lib/types/DatePickerValue";
import {useEffect, useState} from "react";
import dayjs from "dayjs";

const ContractDateFilter: ColumnFilter<Contract> = (accessor, value, setValue) => {

    const dateGte = value?.find((v) => v.operator === 'gte')?.value;
    const dateLte = value?.find((v) => v.operator === 'lte')?.value;

    const [dateRange, setDateRange] = useState<DatesRangeValue>([ dateGte ? new Date(dateGte) : null, dateLte ? new Date(dateLte) : null]);


    useEffect(() => {
        if((dateRange[0] === null) !== (dateRange[1] === null)) return;
        setValue([
            {value: dateRange[0] ? dayjs(dateRange[0]).format("YYYY-MM-DD") : undefined, field: accessor, operator: "gte"},
            {value: dateRange[1] ? dayjs(dateRange[1]).format("YYYY-MM-DD") : undefined, field: accessor, operator: "lte"},
        ]);

    }, [dateRange]);


    return (
        <Stack>
            <DatePicker
                locale="fr"
                type="range"
                value={dateRange}
                onChange={setDateRange}
            />
            <Button
                disabled={!dateRange}
                variant="light"
                onClick={() => {
                    setDateRange([null, null]);
                }}
            >
                Effacer
            </Button>
        </Stack>
    )
}

export default ContractDateFilter;
