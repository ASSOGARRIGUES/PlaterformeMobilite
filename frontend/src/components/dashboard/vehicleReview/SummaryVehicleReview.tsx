import {List} from "@refinedev/mantine";
import {Fieldset, Group, LoadingOverlay, Stack} from "@mantine/core";
import ReferentGroupEditor from "./ReferentGroupEditor";
import ReferentGroup from "./ReferentGroup";
import {useEffect, useState} from "react";
import {useApiUrl, useCustom, useShow} from "@refinedev/core";

const SummaryVehicleReview = ({referentGroups: groups, setReferentGroups: setGroups}: {referentGroups: ReferentGroup[], setReferentGroups: (referentGroups: ReferentGroup[])=>void}) => {

    const [groupsStats, setGroupsStats] = useState<(ReferentGroup & {count:number})[]>([]);

    const apiUrl = useApiUrl();

    const {data: groupedData, isFetching: groupedLoading} = useCustom({
        url: `${apiUrl}/contract-stats/ongoing_grouped/`,
        method: "post",
        config:{
            payload: groups.map((group) => ({id:group.id, referents: group.referents.map((ref)=>ref.id)}))
        }
    })

    const {data: contractGlobalStats, isFetching: contractGlobalLoading} = useCustom({
        url: `${apiUrl}/contract-stats/`,
        method: "get",
    })

    const {data: vehicleGlobalStats, isFetching: vehicleGlobalLoading} = useCustom({
        url: `${apiUrl}/vehicle-stats/`,
        method: "get",
    })

    useEffect(() => {
        if(!groupedData) return;

        const groupedStats = groups.map((group) => {
            const groupData = groupedData.data[group.id];
            return {
                ...group,
                count: groupData || 0
            }
        })

        setGroupsStats(groupedStats);
    }, [groupedData, groups]);


    const groupedStatsNodes = groupsStats.map((group) => {
        return (
            <div key={group.id} style={{color: group.color}}>
                {group.name}: {group.count}
            </div>
        )
    })

    return (
        <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
            <Stack>
                <Fieldset legend="Groupes de référents">
                    <ReferentGroupEditor onChange={setGroups}/>
                </Fieldset>

                <Fieldset legend="Résumé" pos="relative">
                    <LoadingOverlay visible={groupedLoading || contractGlobalLoading || vehicleGlobalLoading}/>
                    <Stack>
                        <Group gap={60}>
                            {groupedStatsNodes}
                            <div>Total à dispo: {contractGlobalStats?.data.current.pending+contractGlobalStats?.data.current.waiting}</div>
                        </Group>
                        <Group gap={60}>
                            <div>En maintenance: {vehicleGlobalStats?.data.maintenance}</div>
                            <div>Disponible: {vehicleGlobalStats?.data.available}</div>
                        </Group>
                    </Stack>
                </Fieldset>
            </Stack>

        </List>
    )
}

export default SummaryVehicleReview