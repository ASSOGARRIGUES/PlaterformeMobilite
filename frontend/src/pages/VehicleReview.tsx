import {Center, Paper, Tabs, Title} from "@mantine/core";
import AttributedVehicleReview from "../components/dashboard/vehicleReview/AttributedVehicleReview";
import ParkedVehicleReview from "../components/dashboard/vehicleReview/ParkedVehicleReview";

const VehicleReview = () => {
    return (
        <Paper shadow="sm" p="md" style={{display:"flex", flexDirection:"column"}}>
            <Center><Title order={2}>Revue véhicule</Title></Center>
            <Tabs variant="outline" style={{display:"flex", flexDirection:"column"}}>
                <Tabs.List grow>
                    <Tabs.Tab value={"attributed"}>Attribués</Tabs.Tab>
                    <Tabs.Tab value={"depot"}>En dépot</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value={"attributed"}>
                    <AttributedVehicleReview/>
                </Tabs.Panel>

                <Tabs.Panel value={"depot"}>
                    <ParkedVehicleReview/>
                </Tabs.Panel>
            </Tabs>
        </Paper>
    );
}

export default VehicleReview;