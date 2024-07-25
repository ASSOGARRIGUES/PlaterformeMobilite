import {MultiSelect} from "@mantine/core";
import {IconSearch} from "@tabler/icons-react";
import {useState} from "react";
import {VehicleStatusEnum} from "../../../types/schema.d";
import {vehicleStatusLabelMap} from "../../../constants";
import {CrudFilter} from "@refinedev/core";
import {ColumnFilter} from "../../SearchableDataTable";
import {Vehicle} from "../../../types/vehicle";


const VehicleStatusFilter: ColumnFilter<Vehicle> = (accessor, value, setValue) => {

    const fieldValues = value?.[0]?.value

    const changeHandle = (values: string[]) => {
        setValue([{value: values, field:accessor, operator: "in"}]);
    }

    const statusData = Object.values(VehicleStatusEnum).map((status) => ({value: status, label: vehicleStatusLabelMap[status]}));

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

export default VehicleStatusFilter;
