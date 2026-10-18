import { Button, Stack, Title } from "@mantine/core";
import { IconClipboardCheck, IconTool } from "@tabler/icons-react";
import { useGo } from "@refinedev/core";
import { OpenSheetBanner } from "../../components/garage/OpenSheetBanner";
import CanAccess from "../../components/CanAccess";

export default function GarageDashboard() {
    const go = useGo();
    return (
        <Stack p="md">
            <Title order={2}>Module Garage</Title>
            <OpenSheetBanner />
            <CanAccess permKey="garage.view_inspectionsheet">
                <OpenSheetBanner kind="controle" />
            </CanAccess>
            <Button
                variant="light"
                leftSection={<IconTool size={18} />}
                onClick={() => go({ to: "/garage/intervention" })}
                style={{ alignSelf: "flex-start" }}
            >
                Voir les interventions
            </Button>
            <CanAccess permKey="garage.manage_inspection">
                <Button
                    color="cyan"
                    leftSection={<IconClipboardCheck size={18} />}
                    onClick={() => go({ to: "/garage/inspection/create" })}
                    style={{ alignSelf: "flex-start" }}
                >
                    Nouveau contrôle
                </Button>
            </CanAccess>
        </Stack>
    );
}
