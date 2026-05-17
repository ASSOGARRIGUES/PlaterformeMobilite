import {Badge, Box, Group, Paper, ScrollArea, Skeleton, Stack, Text} from "@mantine/core";
import {useApiUrl, useCustom} from "@refinedev/core";
import {Contract} from "../../types/contract";
import {ContractStatusEnum} from "../../types/schema.d";

const STATUS_LABELS: Record<string, string> = {
    waiting: "En attente d'EDL",
    pending: "En cours",
    over: "Clôturé",
    payed: "Payé",
};

const STATUS_COLORS: Record<string, string> = {
    waiting: "yellow",
    pending: "blue",
    over: "gray",
    payed: "green",
};

const ContractNode = ({contract, isCurrent}: {contract: Contract; isCurrent: boolean}) => {
    const totalDue = contract.price - (contract.discount ?? 0);
    const kmRange = `${contract.start_kilometer.toLocaleString()} → ${contract.end_kilometer != null ? contract.end_kilometer.toLocaleString() : "?"} km`;

    return (
        <Paper
            p="md"
            withBorder
            style={{
                minWidth: 200,
                flexShrink: 0,
                borderColor: isCurrent ? "var(--mantine-color-blue-6)" : undefined,
                borderWidth: isCurrent ? 2 : 1,
            }}
        >
            <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                    <Text fw={700} size="sm">#{contract.id}</Text>
                    {isCurrent && <Badge size="xs" color="blue">Actuel</Badge>}
                </Group>
                <Badge size="sm" color={STATUS_COLORS[contract.status ?? "pending"]} style={{alignSelf: "flex-start"}}>
                    {STATUS_LABELS[contract.status ?? "pending"]}
                </Badge>
                <Text size="xs" c="dimmed">
                    {contract.start_date} → {contract.end_date}
                </Text>
                <Text size="xs">{kmRange}</Text>
                <Text size="xs">{totalDue} €</Text>
            </Stack>
        </Paper>
    );
};

const Connector = ({km}: {km: number | null}) => (
    <Group gap={0} align="center" wrap="nowrap" style={{flexShrink: 0}}>
        <Box style={{height: 2, width: 24, backgroundColor: "var(--mantine-color-gray-4)"}}/>
        <Text size="xs" c="dimmed" style={{whiteSpace: "nowrap", padding: "0 6px"}}>
            {km != null ? `+${km.toLocaleString()} km` : ""}
        </Text>
        <Box style={{height: 2, width: 24, backgroundColor: "var(--mantine-color-gray-4)"}}/>
    </Group>
);

const ContractRenewalTimeline = ({contract}: {contract: Contract}) => {
    const apiUrl = useApiUrl();
    const {data, isLoading} = useCustom<Contract[]>({
        url: `${apiUrl}/contract/${contract.id}/renewal_history`,
        method: "get",
        queryOptions: {
            queryKey: ["contract-renewal-history", contract.id],
        },
    });

    if (isLoading) {
        return (
            <Group p="md" wrap="nowrap">
                {[1, 2, 3].map(i => <Skeleton key={i} height={120} width={200} radius="sm"/>)}
            </Group>
        );
    }

    const chain: Contract[] = data?.data ?? [];

    if (chain.length <= 1) {
        return (
            <Text c="dimmed" ta="center" mt="xl">
                Ce contrat n'a pas d'historique de renouvellement.
            </Text>
        );
    }

    return (
        <ScrollArea>
            <Group gap={0} align="flex-start" wrap="nowrap" p="md">
                {chain.map((c, i) => {
                    const next = chain[i + 1];
                    const km = c.end_kilometer != null && next != null
                        ? c.end_kilometer - c.start_kilometer
                        : null;
                    return (
                        <Group key={c.id} gap={0} align="flex-start" wrap="nowrap">
                            <ContractNode contract={c} isCurrent={c.id === contract.id}/>
                            {next && <Connector km={km}/>}
                        </Group>
                    );
                })}
            </Group>
        </ScrollArea>
    );
};

export default ContractRenewalTimeline;
