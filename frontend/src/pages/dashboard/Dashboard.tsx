import {Center, Group, Paper, Stack, Title, ActionIcon, Button} from "@mantine/core";
import BackTodayTable from "../../components/dashboard/BackTodayTable";
import {useGetIdentity} from "@refinedev/core";
import LateReturnTable from "../../components/dashboard/LateReturnTable";
import OnGoingContractTable from "../../components/dashboard/OnGoingContractTable";
import WaitingForPaymentTable from "../../components/dashboard/WaitingForPaymentTable";
import {IconInfoCircle} from "@tabler/icons-react";
import React from "react";
import {closeAllModals, closeModal, openModal} from "@mantine/modals";


const Dashboard = () => {
    const {data: myIdentity} = useGetIdentity();

    function info() {
        openModal({
            title: "Tableau de bord",
            children: (<div>
                    <p>
                        Le tableau de bord vous permet de consulter les informations importantes concernant les contrats dont vous êtes le référent.<br/>
                        Pour obtenir plus de détails sur un contrat, cliquez sur la ligne correspondante.
                    </p>

                    <Button onClick={() => {closeAllModals()}}>Ok</Button>
                </div>
            )
        })
    }

    return (
        <Stack>
            <Paper>
                <Center>
                    <Title>Tableau de bord</Title>
                    <ActionIcon title="Tableau de bord" color="blue" radius="xl" style={{margin: "0.5em"}} onClick={info}>
                        <IconInfoCircle/>
                    </ActionIcon>
                </Center>
            </Paper>

            <Group position="apart" grow style={{alignItems: "stretch"}}>
                <Paper style={{display:"flex", flexDirection: "column"}}>
                    <Center><Title order={2}>Retour du jour</Title></Center>
                    <div style={{flex: "auto", padding:"0 0.4em"}}>
                        <BackTodayTable onlyForUser={myIdentity}/>
                    </div>
                </Paper>
                <Paper style={{display:"flex", flexDirection: "column"}}>
                    <Center><Title order={2}>En attente de paiement</Title></Center>
                    <div style={{flex: "auto", padding:"0 0.4em"}}>
                        <WaitingForPaymentTable onlyForUser={myIdentity}/>
                    </div>
                </Paper>
            </Group>

            <Paper style={{display:"flex", flexDirection: "column"}}>
                <Center><Title order={2}>Retard</Title></Center>
                <div style={{flex: "auto", padding:"0 0.4em"}}>
                    <LateReturnTable onlyForUser={myIdentity}/>
                </div>
            </Paper>
            <Paper style={{flex:"auto", display:"flex", flexDirection: "column"}}>
                <Center><Title order={2}>Contrat en cours</Title></Center>
                <div style={{flex: "auto", padding:"0 0.4em"}}>
                    <OnGoingContractTable onlyForUser={myIdentity}/>
                </div>
            </Paper>

        </Stack>
    )

}

export default Dashboard;