import {Center, Group, Paper, Stack, Title} from "@mantine/core";
import BackTodayTable from "../../components/dashboard/BackTodayTable";
import {useGetIdentity} from "@refinedev/core";
import LateReturnTable from "../../components/dashboard/LateReturnTable";
import OnGoingContractTable from "../../components/dashboard/OnGoingContractTable";
import WaitingForPaymentTable from "../../components/dashboard/WaitingForPaymentTable";


const Dashboard = () => {

    const {data: myIdentity} = useGetIdentity();

    return (
        <Stack>
            <Paper>
                <Center><Title>Tableau de bord</Title></Center>
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