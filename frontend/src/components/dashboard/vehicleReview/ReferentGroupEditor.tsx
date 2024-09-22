import {User} from "../../../types/auth";
import {ActionIcon, SimpleGrid, Stack, Text, Tooltip} from "@mantine/core";
import ReferentGroup from "./ReferentGroup";
import {useUserActions} from "../../../context/UserActionsProvider";
import {useList} from "@refinedev/core";
import {humanizeFirstName, humanizeLastName} from "../../../constants";
import React, {useEffect} from "react";
import { useLocalStorage} from "@mantine/hooks";
import {IconCirclePlus} from "@tabler/icons-react";
import superjson from 'superjson';

const ReferentGroupEditor = ({onChange} : {onChange: (groups:ReferentGroup[]) => void})=>{

    const defaultValue: {[key in number]:ReferentGroup[]} = {};
    const useUserAction = useUserActions()
    const actionId = useUserAction.current_action?.id;

    const [groupsData, setGroupsData] = useLocalStorage({
        key: 'contract-stats-referent-groups',
        defaultValue,
        serialize: superjson.stringify,
        deserialize: (str) =>
            str === undefined ? defaultValue : superjson.parse(str),
    });

    useEffect(() => {
        if(!actionId) return;
        onChange(groupsData[actionId] || []);
    }, [groupsData, actionId]);


    const {data, isLoading} = useList<User>({
        resource: "referent",
        pagination: {pageSize: 30},
        filters: [
            {
                field: "actions",
                operator: "eq",
                value: useUserAction?.current_action?.id
            },
        ]
    })

    const referentOptions = data?.data.map((referent) => ({
        value: referent.id.toString(),
        label: humanizeFirstName(referent.first_name)+" "+referent.last_name?.substring(0,1).toUpperCase()+".",
    })) || []


    const addGroup = () => {
        if(!actionId) return;

        const newGroup: ReferentGroup = {
            id: groupsData[actionId]?.length+1 || 1,
            name: "Nouveau groupe",
            color: "red",
            referents: []
        }

        //if the action doesn't have any groups, create an empty array
        if(!groupsData[actionId]){
            setGroupsData({
                ...groupsData,
                [actionId]: [newGroup]
            })
            return
        }

        setGroupsData({
            ...groupsData,
            [actionId]: [...groupsData[actionId], newGroup]
        })
    }

    const groupDelete = (id:number) => {
        if (!actionId) return;
        const newGroups = groupsData[actionId].filter((group) => group.id !== id);
        setGroupsData({
            ...groupsData,
            [actionId]: newGroups
        })
    }
    const groupChange = (group:Omit<ReferentGroup, "referents"> & {referents: number[]}) => {
        if (!actionId) return;

        //Map the referents id to the referent object
        const referents = group.referents.map((id) => data?.data.find((referent) => referent.id === id) as User);
        console.log("Changed group", group);
        //Update the group
        const newGroups = groupsData[actionId].map((g) => {
            if(g.id === group.id){
                return {
                    ...g,
                    ...group,
                    referents
                }
            }
            return g;
        })

        console.log(newGroups);

        setGroupsData({
            ...groupsData,
            [actionId]: newGroups
        })
    }

    const referentGroups = actionId ? groupsData[actionId]?.map((group) => {
        return (<ReferentGroup
            key={group.id}
            referentGroup={group}
            referentData={referentOptions}
            isLoading={isLoading}
            onDelete={groupDelete}
            onChange={groupChange}
        />)
    }) : [];

    return (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {referentGroups}

            <Stack justify="center" align="center" gap={0}>
                <Tooltip label={"Nouveau"} position={"bottom"} openDelay={200} >
                    <ActionIcon  style={{flex:"initial"}} size={50} variant="subtle" radius="lg" color = "green" onClick={addGroup}>
                        <IconCirclePlus size={50}/>
                    </ActionIcon>
                </Tooltip>
                <Text>Ajouter un groupe</Text>
            </Stack>

        </SimpleGrid>
    )
}

export default ReferentGroupEditor;