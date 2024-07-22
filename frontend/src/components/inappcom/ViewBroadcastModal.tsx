import {Button, Divider, Group, Modal, Stack, Title, ScrollArea, LoadingOverlay} from "@mantine/core";
import {useEffect, useState} from "react";
import {useList, HttpError, useCustomMutation, useApiUrl, useInvalidate} from "@refinedev/core";
import {BroadcastMessage} from "../../types/inappcom";
import Shifter from "./Shifter";

const ViewBroadcastModal = () => {
    const apiUrl = useApiUrl();
    const {mutateAsync, isLoading: isMutationLoading} = useCustomMutation();
    const invalidate = useInvalidate();

    const [opened, setOpened] = useState(false);

    const [page, setPage] = useState(1);

    const [broadcastList, setBroadcastList] = useState<BroadcastMessage[]>([]);
    const [currentBroadcast, setCurrentBroadcast] = useState<BroadcastMessage | undefined>(undefined);

    const { data, isLoading, isError, refetch } = useList<BroadcastMessage, HttpError>({
        resource: "appcom/broadcast",
    });

    useEffect(() => {
        if (!data || data.data.length === 0){
            setOpened(false);
            return;
        }
        setOpened(true);
        setBroadcastList(data.data);
    }, [data?.data]);

    useEffect(() => {
        if(broadcastList.length === 0){
            setOpened(false);
            return;
        }
        setCurrentBroadcast(broadcastList[0])
    }, [broadcastList]);


    const pageChange = (value: number) => {
        setPage(value);
        setCurrentBroadcast(broadcastList[value-1])
    }

    const neverShowAgain = async () => {
        await mutateAsync({
            url: `${apiUrl}/appcom/broadcast/`,
            method: "post",
            values: {
                broadcast_id: currentBroadcast?.id
            },
        });

        await invalidate({
            resource: "appcom/broadcast",
            invalidates: ["list"]
        });

    }

    return (
        <Modal opened={opened} onClose={()=>setOpened(false)} size="55rem" title="Communications">
            <>

                {/*<Button onClick={()=>refetch()} >Rafraîchir</Button>*/}
                {!currentBroadcast && <p>Aucune communication en attente de lecture</p>}
                {currentBroadcast && (
                    <Stack gap={4}>
                        <Group justify="space-between">
                            <Title order={4} >{currentBroadcast.title}</Title>
                            <Shifter value={page} onChange={pageChange} min={1} max={broadcastList.length ?? 0}/>
                        </Group>
                        <Divider/>

                        <ScrollArea.Autosize mah={"60vh"}>
                            <LoadingOverlay visible={isLoading || isMutationLoading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
                            <div dangerouslySetInnerHTML={{__html: currentBroadcast.body}}/>
                        </ScrollArea.Autosize>

                        <Divider/>

                        <Group grow>
                            <Button onClick={()=>setOpened(false)}>Lire plus tard</Button>
                            <Button onClick={()=>neverShowAgain()} color="red">Ne plus afficher</Button>
                        </Group>

                    </Stack>
                )}
            </>
        </Modal>
    )


}

export default ViewBroadcastModal;