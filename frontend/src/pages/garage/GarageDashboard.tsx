import { Stack, Title } from "@mantine/core";
import { OpenSheetBanner } from "../../components/garage/OpenSheetBanner";

export default function GarageDashboard() {
    return (
        <Stack p="md">
            <Title order={2}>Module Garage</Title>
            <OpenSheetBanner />
        </Stack>
    );
}
