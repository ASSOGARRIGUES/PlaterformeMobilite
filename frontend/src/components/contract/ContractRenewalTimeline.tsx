import React, {useEffect, useRef, useState} from "react";
import {Badge, Box, Group, HoverCard, Paper, ScrollArea, Stack, Text, Title} from "@mantine/core";
import {useApiUrl, useCustom, useGetToPath, useGo, useResource} from "@refinedev/core";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import {Contract} from "../../types/contract";
import {ContractStatusEnum} from "../../types/schema.d";
import {contractStatusLabelMap, humanizeNumber} from "../../constants";

dayjs.locale("fr");

const STATUS_STYLE: Record<string, {badge: string; segment: string}> = {
    [ContractStatusEnum.waiting]: {badge: "orange", segment: "var(--mantine-color-orange-6)"},
    [ContractStatusEnum.pending]: {badge: "teal",   segment: "var(--mantine-color-teal-6)"},
    [ContractStatusEnum.over]:    {badge: "red",    segment: "var(--mantine-color-red-6)"},
    [ContractStatusEnum.payed]:   {badge: "gray",   segment: "var(--mantine-color-gray-5)"},
};

type EventType = "creation" | "renouvellement" | "today" | "echeance" | "fin";
const EVENT_LABEL: Record<EventType, string> = {
    creation:       "Création",
    renouvellement: "Renouvellement",
    today:          "Aujourd'hui",
    echeance:       "Échéance",
    fin:            "Clôture",
};
type ChainEvent = { key: string; date: string; type: EventType; contract?: Contract };

const DOT_STYLES: Record<EventType, React.CSSProperties> = {
    creation:       {width: 10, height: 10, background: "var(--mantine-color-dark-7)", border: "2px solid var(--mantine-color-dark-7)"},
    renouvellement: {width: 10, height: 10, background: "white", border: "2px solid var(--mantine-color-gray-6)"},
    today:          {width: 14, height: 14, background: "var(--mantine-color-blue-6)", border: "3px solid white", boxShadow: "0 0 0 1px var(--mantine-color-blue-6)"},
    echeance:       {width: 12, height: 12, background: "white", border: "2px dashed var(--mantine-color-blue-6)"},
    fin:            {width: 10, height: 10, background: "var(--mantine-color-teal-6)", border: "2px solid var(--mantine-color-teal-6)"},
};

function formatReferent(c: Contract): string {
    const ref = c.referent as any;
    const first: string = ref?.first_name ?? "";
    const last:  string = ref?.last_name  ?? "";
    return `${first} ${last ? last[0] + "." : ""}`.trim() || "—";
}

function getDistance(c: Contract): string {
    if (c.end_kilometer != null) return `${humanizeNumber(c.end_kilometer - c.start_kilometer)} km`;
    if (c.max_kilometer != null) return `${humanizeNumber(c.max_kilometer)} km`;
    return "—";
}

function HoverContent({contract: c, isCurrent}: {contract: Contract; isCurrent: boolean}) {
    const due    = c.price - (c.discount ?? 0);
    const status = c.status ?? ContractStatusEnum.pending;
    return (
        <Stack gap="xs" style={{minWidth: 240}}>
            <Group gap="xs" wrap="nowrap">
                <Badge color={STATUS_STYLE[status].badge} variant="light" size="sm">
                    {contractStatusLabelMap[status as keyof typeof contractStatusLabelMap]}
                </Badge>
                <Text ff="monospace" size="xs" c="dimmed" fw={600}>#{c.id}</Text>
                {isCurrent && (
                    <Text ff="monospace" size="xs" c="blue" fw={600}
                        style={{marginLeft: "auto", textTransform: "uppercase", letterSpacing: "0.08em"}}>
                        Actuel
                    </Text>
                )}
            </Group>
            <Text fw={600} size="md">
                {dayjs(c.start_date).format("D MMM")}
                <Text span c="dimmed" fw={400}> → </Text>
                {dayjs(c.end_date).format("D MMM")}
            </Text>
            <Group grow gap="xs">
                {[
                    {label: "Montant",  value: `${due} €`},
                    {label: "Distance", value: getDistance(c)},
                    {label: "Référent", value: formatReferent(c)},
                ].map(({label, value}) => (
                    <Stack key={label} gap={2}>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{fontSize: 9, letterSpacing: "0.08em"}}>{label}</Text>
                        <Text size="xs" fw={600}>{value}</Text>
                    </Stack>
                ))}
            </Group>
        </Stack>
    );
}

function DotMarker({type, isHot}: {type: EventType; isHot: boolean}) {
    return <Box style={{
        position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%, -50%) scale(${isHot ? 1.3 : 1})`,
        borderRadius: "50%", transition: "transform 0.12s", zIndex: 3,
        ...DOT_STYLES[type],
    }}/>;
}

const PAD_X = 56;

export default function ContractRenewalTimeline({contract}: {contract: Contract}) {
    const apiUrl = useApiUrl();
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const go = useGo();
    const getToPath = useGetToPath();
    const {select} = useResource();
    const viewportRef = useRef<HTMLDivElement>(null);
    const wrapRef     = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            const vp = viewportRef.current;
            if (!vp || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            vp.scrollLeft += e.deltaY;
        };
        el.addEventListener("wheel", handler, {passive: false});
        return () => el.removeEventListener("wheel", handler);
    }, []);

    const {data, isLoading} = useCustom<Contract[]>({
        url: `${apiUrl}/contract/${contract.id}/renewal_history`,
        method: "get",
        queryOptions: {queryKey: ["contract-renewal-history", contract.id]},
    });

    const chain: Contract[] = data?.data ?? [];

    if (isLoading) return <Text c="dimmed" p="md">Chargement…</Text>;
    if (chain.length < 2) return <Text c="dimmed" ta="center" mt="xl">Ce contrat n'a pas d'historique de renouvellement.</Text>;

    const t0   = dayjs(chain[0].start_date);
    const tN   = dayjs(chain[chain.length - 1].end_date);
    const span = Math.max(1, tN.diff(t0, "day"));
    const pct  = (date: string) => (dayjs(date).diff(t0, "day") / span) * 100;

    const events: ChainEvent[] = chain.map((c, i) => ({
        key: `s-${c.id}`, date: c.start_date,
        type: (i === 0 ? "creation" : "renouvellement") as EventType, contract: c,
    }));
    const last = chain[chain.length - 1];
    events.push({
        key: `e-${last.id}`, date: last.end_date,
        type: (last.status === ContractStatusEnum.pending || last.status === ContractStatusEnum.waiting) ? "echeance" : "fin",
        contract: last,
    });
    const today = dayjs();
    if (today.isAfter(t0) && today.isBefore(tN))
        events.push({key: "today", date: today.format("YYYY-MM-DD"), type: "today"});
    events.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));

    const {totalKm, totalDue} = chain.reduce((acc, c) => ({
        totalKm:  acc.totalKm + Math.max(0, c.end_kilometer != null ? c.end_kilometer - c.start_kilometer : (c.max_kilometer ?? 0)),
        totalDue: acc.totalDue + (c.price - (c.discount ?? 0)),
    }), {totalKm: 0, totalDue: 0});

    function navigateTo(id: number) {
        go({to: getToPath({resource: select("contract").resource, action: "show", meta: {id}})});
    }

    return (
        <Stack gap="sm" style={{margin: "0.5em 0.6em"}}>
            <Group justify="space-between" align="baseline" wrap="wrap">
                <Title order={4}>Historique des renouvellements</Title>
                <Group gap="xs">
                    <Text size="sm" c="dimmed">{chain.length} contrats</Text>
                    <Text size="sm" c="gray.4">·</Text>
                    <Text size="sm" c="dimmed">depuis le {dayjs(chain[0].start_date).format("DD/MM/YYYY")}</Text>
                    <Text size="sm" c="gray.4">·</Text>
                    <Text size="sm" c="dimmed">{humanizeNumber(totalKm)} km</Text>
                    <Text size="sm" c="gray.4">·</Text>
                    <Text size="sm" c="dimmed">{humanizeNumber(totalDue)} €</Text>
                </Group>
            </Group>

            <Paper withBorder>
                <ScrollArea scrollbars="x" viewportRef={viewportRef}>
                    <Box ref={wrapRef} style={{
                        position: "relative",
                        paddingTop: 80, paddingBottom: 88,
                        paddingLeft: PAD_X, paddingRight: PAD_X,
                        minWidth: 480,
                        boxSizing: "border-box",
                    }}>
                        <Box style={{position: "absolute", left: PAD_X, right: PAD_X, top: 0, bottom: 0}}>

                            {/* Baseline */}
                            <Box style={{
                                position: "absolute", left: 0, right: 0,
                                top: "50%", height: 1,
                                background: "var(--mantine-color-gray-3)",
                                transform: "translateY(-1px)",
                            }}/>

                            {/* Segments */}
                            <Box style={{position: "absolute", left: 0, right: 0, top: "50%", height: 4, transform: "translateY(-2px)"}}>
                                {chain.map(c => {
                                    const isHot     = hoveredId === c.id;
                                    const isCurrent = c.id === contract.id;
                                    const style     = STATUS_STYLE[c.status ?? ContractStatusEnum.pending];
                                    return (
                                        <HoverCard key={c.id} openDelay={50} closeDelay={100} position="top" withArrow
                                            onOpen={() => setHoveredId(c.id)} onClose={() => setHoveredId(null)}>
                                            <HoverCard.Target>
                                                <Box style={{
                                                    position: "absolute",
                                                    left: `${pct(c.start_date)}%`,
                                                    width: `${Math.max(0, pct(c.end_date) - pct(c.start_date))}%`,
                                                    minWidth: 4,
                                                    top: isHot ? -2 : 0,
                                                    height: isHot ? 8 : 4,
                                                    borderRadius: 2,
                                                    background: style.segment,
                                                    cursor: isCurrent ? "default" : "pointer",
                                                    transition: "height 0.12s, top 0.12s",
                                                    boxShadow: isCurrent
                                                        ? `0 0 0 3px color-mix(in oklch, ${style.segment} 25%, transparent)`
                                                        : undefined,
                                                }} onClick={() => !isCurrent && navigateTo(c.id)}/>
                                            </HoverCard.Target>
                                            <HoverCard.Dropdown p="sm">
                                                <HoverContent contract={c} isCurrent={isCurrent}/>
                                            </HoverCard.Dropdown>
                                        </HoverCard>
                                    );
                                })}
                            </Box>

                            {/* Labels + dots — une seule boucle */}
                            {events.map((ev, i) => {
                                const isHot      = ev.contract ? hoveredId === ev.contract.id : false;
                                const labelAbove = i % 2 === 1;
                                return (
                                    <React.Fragment key={ev.key}>
                                        {/* Label */}
                                        <Box style={{
                                            position: "absolute",
                                            left: `${pct(ev.date)}%`,
                                            transform: "translateX(-50%)",
                                            textAlign: "center",
                                            whiteSpace: "nowrap",
                                            pointerEvents: "none",
                                            zIndex: 2,
                                            ...(labelAbove ? {bottom: "calc(50% + 18px)"} : {top: "calc(50% + 18px)"}),
                                        }}>
                                            <Text ff="monospace" size="xs" fw={600} c={ev.type === "today" ? "blue" : "dark"}>
                                                {dayjs(ev.date).format("D MMM")}
                                            </Text>
                                            <Text c={ev.type === "today" ? "blue" : "dimmed"}
                                                fw={ev.type === "today" ? 600 : 500}
                                                style={{fontSize: 9, textTransform: "uppercase", letterSpacing: "0.09em"}}>
                                                {EVENT_LABEL[ev.type]}
                                            </Text>
                                            {ev.contract && ev.type !== "fin" && ev.type !== "echeance" && (
                                                <Text ff="monospace" c="blue" fw={600} style={{fontSize: 10}}>
                                                    #{ev.contract.id}
                                                </Text>
                                            )}
                                        </Box>
                                        {/* Dot */}
                                        <Box style={{
                                            position: "absolute",
                                            width: 32, height: 32,
                                            left: `calc(${pct(ev.date)}% - 16px)`,
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            zIndex: 4,
                                            pointerEvents: "none",
                                        }}>
                                            <DotMarker type={ev.type} isHot={isHot}/>
                                        </Box>
                                    </React.Fragment>
                                );
                            })}
                        </Box>
                    </Box>
                </ScrollArea>
            </Paper>
        </Stack>
    );
}
