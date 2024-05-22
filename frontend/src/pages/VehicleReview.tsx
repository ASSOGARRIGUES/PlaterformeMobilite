import {Center, Paper, Tabs, Title} from "@mantine/core";
import AttributedVehicleReview from "../components/dashboard/vehicleReview/AttributedVehicleReview";

const VehicleReview = () => {
    return (
        <Paper shadow="sm" p="md">
            <Center><Title order={2}>Revue véhicule</Title></Center>
            <Tabs variant="outline">
                <Tabs.List grow>
                    <Tabs.Tab value={"attributed"}>Attribués</Tabs.Tab>
                    <Tabs.Tab value={"depot"}>En dépot</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value={"attributed"}>
                    <AttributedVehicleReview/>
                </Tabs.Panel>

                <Tabs.Panel value={"depot"}>
                    En dépot
                </Tabs.Panel>
            </Tabs>
        </Paper>
    );
}

export default VehicleReview;