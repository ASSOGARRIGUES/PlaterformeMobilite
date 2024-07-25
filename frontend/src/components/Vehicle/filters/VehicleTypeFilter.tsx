import {ColumnFilter} from "../../SearchableDataTable";
import {Vehicle} from "../../../types/vehicle";
import {Stack, MultiSelect} from "@mantine/core";
import {IconSearch} from "@tabler/icons-react";
import {FuelTypeEnum, TransmissionEnum} from "../../../types/schema.d";
import {fuelTypeLabelMap} from "../../../constants";

const VehicleTypeFilter : ColumnFilter<Vehicle> = (accessor, value, setValue) => {

    const fuelData = Object.values(FuelTypeEnum).map((fuel) => ({value: fuel, label: fuelTypeLabelMap[fuel]}));

    const transmissionData = Object.values(TransmissionEnum).map((transmission) => ({value: transmission, label: transmission}));

    const fuelValues = value?.find((v) => v.field === "fuel_type")?.value;
    const transmissionValues = value?.find((v) => v.field === "transmission")?.value;


    const handleChange = (fuelValues: string[], transmissionValues: string[]) => {
        setValue([
            {value: fuelValues ?? [], field: "fuel_type", operator: "in"},
            {value: transmissionValues ?? [], field: "transmission", operator: "in"},
        ]);
    }

    const handleFuelChange = (values: string[]) => {
        handleChange(values, transmissionValues);
    }

    const handleTransmissionChange = (values: string[]) => {
        handleChange(fuelValues, values);
    }

    return (
        <Stack>
            <MultiSelect
                label="Carburant"
                data={fuelData}
                value={fuelValues}
                placeholder="Choisir un ou plusieurs statuts"
                onChange={handleFuelChange}
                clearable
                comboboxProps={{ withinPortal: false }}
                w={250}
            />

            <MultiSelect
                label="Transmission"
                data={transmissionData}
                value={transmissionValues}
                placeholder="Choisir un ou plusieurs statuts"
                onChange={handleTransmissionChange}
                clearable
                comboboxProps={{ withinPortal: false }}
                w={250}
            />
        </Stack>
    );
}

export default VehicleTypeFilter;
