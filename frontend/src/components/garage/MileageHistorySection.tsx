import { useMemo } from "react";
import { Badge, Group, Stack, Text, Title } from "@mantine/core";
import { MileageEntry } from "../../types/garage";
import { humanizeDate, mileageSourceLabelMap } from "../../constants";
import SearchableDataTable, { SearchableDataTableColumn } from "../SearchableDataTable";

type Props = {
    vehicleId: number;
    currentKilometer: number;
};

const MileageHistorySection = ({ vehicleId, currentKilometer }: Props) => {
    const columns = useMemo<SearchableDataTableColumn<MileageEntry>[]>(
        () => [
            {
                accessor: "date",
                title: "Date",
                render: (entry) => humanizeDate(entry.date),
            },
            {
                accessor: "value",
                title: "Kilométrage",
                render: (entry) => (
                    <Group gap="xs" wrap="nowrap">
                        <Text>{entry.value} km</Text>
                        {entry.is_corrected && (
                            <Badge color="gray" size="xs">Corrigée</Badge>
                        )}
                    </Group>
                ),
            },
            {
                accessor: "source",
                title: "Source",
                render: (entry) => mileageSourceLabelMap[entry.source],
            },
            {
                accessor: "author_display",
                title: "Auteur",
            },
        ],
        [],
    );

    return (
        <Stack gap="sm">
            <Group justify="space-between" align="baseline">
                <Title order={3}>Historique kilométrique</Title>
                <Text fw={700} fz="xl">{currentKilometer} km</Text>
            </Group>

            <SearchableDataTable<MileageEntry>
                columns={columns}
                resource={`garage/mileage/${vehicleId}`}
                defaultSortedColumn="date"
                defaultSortedDirection="desc"
                withoutSearch
                withArchivedSwitch={false}
                withReloadIcon
            />
        </Stack>
    );
};

export default MileageHistorySection;
