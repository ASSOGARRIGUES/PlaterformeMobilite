import {Center, Paper, Tabs, Title} from "@mantine/core";
import AttributedVehicleReview from "../components/dashboard/vehicleReview/AttributedVehicleReview";
import ParkedVehicleReview from "../components/dashboard/vehicleReview/ParkedVehicleReview";
import SummaryVehicleReview from "../components/dashboard/vehicleReview/SummaryVehicleReview";
import {useState} from "react";
import ReferentGroup from "../components/dashboard/vehicleReview/ReferentGroup";

const VehicleReview = () => {
    const [referentGroups, setReferentGroups] = useState<ReferentGroup[]>([]);

    return (
        <Paper shadow="sm" p="md" style={{display:"flex", flexDirection:"column"}}>
            <Center><Title order={2}>Revue véhicule</Title></Center>

            <Tabs variant="outline" style={{display:"flex", flexDirection:"column"}} defaultValue="summary">
                <Tabs.List grow>
                    <Tabs.Tab value={"summary"}>Résumé</Tabs.Tab>
                    <Tabs.Tab value={"attributed"}>Attribués</Tabs.Tab>
                    <Tabs.Tab value={"depot"}>En dépot</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value={"summary"}>
                    <SummaryVehicleReview referentGroups={referentGroups} setReferentGroups={setReferentGroups}/>
                </Tabs.Panel>

                <Tabs.Panel value={"attributed"}>
                    <AttributedVehicleReview referentGroups={referentGroups}/>
                </Tabs.Panel>

                <Tabs.Panel value={"depot"}>
                    <ParkedVehicleReview/>
                </Tabs.Panel>
            </Tabs>
        </Paper>
    );
}

export default VehicleReview;