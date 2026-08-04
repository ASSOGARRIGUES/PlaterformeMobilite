import { Button, Stack, Title } from "@mantine/core";
import { IconTool } from "@tabler/icons-react";
import { useGo } from "@refinedev/core";
import { OpenSheetBanner } from "../../components/garage/OpenSheetBanner";

export default function GarageDashboard() {
    const go = useGo();
    return (
        <Stack p="md">
            <Title order={2}>Module Garage</Title>
            <OpenSheetBanner />
            <Button
                variant="light"
                leftSection={<IconTool size={18} />}
                onClick={() => go({ to: "/garage/intervention" })}
                style={{ alignSelf: "flex-start" }}
            >
                Voir les interventions
            </Button>
        </Stack>
    );
}
