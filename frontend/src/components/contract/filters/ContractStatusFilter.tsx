import {ColumnFilter} from "../../SearchableDataTable";
import {Contract} from "../../../types/contract";
import {ContractStatusEnum} from "../../../types/schema.d";
import {contractStatusLabelMap} from "../../../constants";
import {MultiSelect} from "@mantine/core";

const ContractStatusFilter : ColumnFilter<Contract> = (accessor, value, setValue) => {

      const fieldValues = value?.[0]?.value

    const changeHandle = (values: string[]) => {
        setValue([{value: values, field:accessor, operator: "in"}]);
    }

    const statusData = Object.values(ContractStatusEnum).map((status) => ({value: status, label: contractStatusLabelMap[status]}));

    return (
        <MultiSelect
            label="Statut"
            description="Filtrer par statut"
            data={statusData}
            value={fieldValues}
            placeholder="Choisir un ou plusieurs statuts"
            onChange={changeHandle}
            clearable
            comboboxProps={{ withinPortal: false }}
            w={250}
        />
    );

}

export default ContractStatusFilter;
