import { Dispatch, SetStateAction, useMemo, useRef, useState } from "react";
import { useGetToPath, useGo, useList, useResource } from "@refinedev/core";
import { Anchor, Button, Group, Loader, Popover, Stack, Text, Title } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { MileageEntry } from "../../types/garage";
import { humanizeDate, humanizeNumber, mileageSourceLabelMap } from "../../constants";
import { useMileageCorrection } from "../../hooks/garage/useMileageCorrection";
import useAccessControl from "../../hooks/useAccessControl";

const BeneficiaryReference = ({ contractId, beneficiaryDisplay }: { contractId: number; beneficiaryDisplay: string }) => {
    const go = useGo();
    const getToPath = useGetToPath();
    const { select } = useResource();
    const { isAuthorized } = useAccessControl();
    const path = getToPath({ resource: select("contract").resource, action: "show", meta: { id: contractId } });

    if (!isAuthorized("api.view_contract")) {
        return <Text size="sm" className="sentry-mask">{beneficiaryDisplay}</Text>;
    }

    return (
        <Anchor size="sm" className="sentry-mask" onClick={(e) => { e.stopPropagation(); go({ to: path }); }}>
            {beneficiaryDisplay}
        </Anchor>
    );
};

type Props = {
    vehicleId: number;
    currentKilometer: number;
};

type ChartPoint = {
    date: string;
    value: number;
    entry: MileageEntry;
};

const HOVER_CLOSE_DELAY = 200;

type MileageDotProps = {
    cx?: number;
    cy?: number;
    payload?: ChartPoint;
    activeEntryId: number | null;
    setActiveEntryId: Dispatch<SetStateAction<number | null>>;
    entriesById: Map<number, MileageEntry>;
    onCorrect?: (entry: MileageEntry) => void;
};

const MileageDot = ({
    cx, cy, payload, activeEntryId, setActiveEntryId, entriesById, onCorrect,
}: MileageDotProps) => {
    const closeTimeoutRef = useRef<number>();
    if (!payload) return null;
    const { entry } = payload;
    const isOpen = activeEntryId === entry.id;

    // Une correction peut elle-même corriger une correction : on remonte la chaîne
    // jusqu'à la toute première entrée pour afficher le véritable point initial.
    let original = entry.corrects ? entriesById.get(entry.corrects) : undefined;
    while (original?.corrects) {
        const parent = entriesById.get(original.corrects);
        if (!parent) break;
        original = parent;
    }

    const cancelClose = () => {
        if (closeTimeoutRef.current) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = undefined;
        }
    };

    const scheduleClose = () => {
        cancelClose();
        closeTimeoutRef.current = window.setTimeout(() => {
            setActiveEntryId((current) => (current === entry.id ? null : current));
        }, HOVER_CLOSE_DELAY);
    };

    return (
        <Popover opened={isOpen} withArrow shadow="md" position="top">
            <Popover.Target>
                <g
                    onMouseEnter={() => { cancelClose(); setActiveEntryId(entry.id); }}
                    onMouseLeave={scheduleClose}
                >
                    <circle cx={cx} cy={cy} r={12} fill="transparent" />
                    <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="var(--mantine-color-blue-6)"
                        stroke="white"
                        strokeWidth={1}
                    />
                </g>
            </Popover.Target>
            <Popover.Dropdown onMouseEnter={cancelClose} onMouseLeave={scheduleClose} maw={280}>
                <Stack gap={4}>
                    {original ? (
                        <>
                            <Group gap={6}>
                                <Text size="sm" td="line-through" c="dimmed">{humanizeNumber(original.value)} km</Text>
                                <Text fw={600}>{humanizeNumber(entry.value)} km</Text>
                            </Group>
                            <Text size="sm">{humanizeDate(entry.date)}</Text>
                            <Group gap={4}>
                                <Text size="sm">{mileageSourceLabelMap[original.source]}</Text>
                                {original.source_id && original.beneficiary_display && (
                                    <BeneficiaryReference contractId={original.source_id} beneficiaryDisplay={original.beneficiary_display} />
                                )}
                            </Group>
                            <Text size="sm" c="dimmed" style={{ overflowWrap: "break-word" }}>
                                Corrigé par {entry.author_display} le {humanizeDate(entry.created_at ?? entry.date)} pour {entry.correction_reason}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text fw={600}>{humanizeNumber(entry.value)} km</Text>
                            <Text size="sm">{humanizeDate(entry.date)}</Text>
                            <Group gap={4}>
                                <Text size="sm">{mileageSourceLabelMap[entry.source]}</Text>
                                {entry.source_id && entry.beneficiary_display && (
                                    <BeneficiaryReference contractId={entry.source_id} beneficiaryDisplay={entry.beneficiary_display} />
                                )}
                            </Group>
                            <Text size="sm" c="dimmed">{entry.author_display}</Text>
                        </>
                    )}
                    {onCorrect && (
                        <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                                setActiveEntryId(null);
                                onCorrect(entry);
                            }}
                        >
                            Corriger
                        </Button>
                    )}
                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
};

const MileageHistoryChart = ({ vehicleId, currentKilometer }: Props) => {
    const { data, isLoading, isError } = useList<MileageEntry>({
        resource: `garage/mileage/${vehicleId}`,
        pagination: { pageSize: 500 },
    });

    const { openCorrectionModal, canCorrect } = useMileageCorrection(vehicleId);
    const [activeEntryId, setActiveEntryId] = useState<number | null>(null);

    const entries = data?.data ?? [];

    const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

    const chartData = useMemo<ChartPoint[]>(() => {
        return entries
            .filter((entry) => !entry.is_corrected)
            .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
            .map((entry) => ({
                date: humanizeDate(entry.date),
                value: entry.value,
                entry,
            }));
    }, [entries]);

    return (
        <Stack gap="sm">
            <Group justify="space-between" align="baseline">
                <Title order={3}>Historique kilométrique</Title>
                <Text fw={700} fz="xl">{humanizeNumber(currentKilometer)} km</Text>
            </Group>

            {isLoading && <Loader size="sm" />}

            {!isLoading && isError && (
                <Text c="red">Erreur lors du chargement de l'historique kilométrique.</Text>
            )}

            {!isLoading && !isError && chartData.length === 0 && (
                <Text c="dimmed">Aucun historique kilométrique pour ce véhicule.</Text>
            )}

            {!isLoading && !isError && chartData.length > 0 && (
                <LineChart
                    h={300}
                    data={chartData}
                    dataKey="date"
                    series={[{ name: "value", label: "Kilométrage", color: "blue.6" }]}
                    curveType="linear"
                    valueFormatter={(value) => `${humanizeNumber(value)} km`}
                    yAxisProps={{ domain: ["auto", "auto"] }}
                    withTooltip={false}
                    lineProps={() => ({
                        dot: (dotProps: any) => (
                            <MileageDot
                                {...dotProps}
                                activeEntryId={activeEntryId}
                                setActiveEntryId={setActiveEntryId}
                                entriesById={entriesById}
                                onCorrect={canCorrect ? openCorrectionModal : undefined}
                            />
                        ),
                    })}
                />
            )}
        </Stack>
    );
};

export default MileageHistoryChart;
