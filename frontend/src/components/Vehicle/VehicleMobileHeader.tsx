import {Button, Drawer, Group, Skeleton, Stack, Text} from "@mantine/core";
import {useDisclosure} from "@mantine/hooks";
import {IconDots, IconInfoCircle} from "@tabler/icons-react";
import {MouseEvent, ReactNode} from "react";
import {Vehicle} from "../../types/vehicle";
import {humanizeNumber} from "../../constants";
import VehicleStatusBadge from "./VehicleStatusBadge";
import VehicleCard from "./VehicleCard";
import VehicleActions from "./VehicleActions";

// En-tête compact (< 768 px) : méta + deux boutons ouvrant des panneaux bas.
// Le titre et le bouton retour restent portés par `Show` dans VehicleShow.
const VehicleMobileHeader = ({vehicle, infoFooter}: {vehicle: Vehicle | undefined, infoFooter?: (close: () => void) => ReactNode}) => {

    const [infoOpened, {open: openInfo, close: closeInfo}] = useDisclosure(false);
    const [actionsOpened, {open: openActions, close: closeActions}] = useDisclosure(false);

    if (!vehicle) return (
        <Stack gap="xs" p="xs" style={{backgroundColor: "white", borderBottom: "1px solid var(--mantine-color-gray-3)"}}>
            <Skeleton height={22} width="80%"/>
            <Skeleton height={40}/>
        </Stack>
    );

    // Un tap sur un bouton d'action (navigation, modale) ne doit pas laisser le panneau ouvert derrière
    const closeOnButton = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest("button")) closeActions();
    };

    return (
        <>
            <Stack gap="xs" p="xs" style={{backgroundColor: "white", borderBottom: "1px solid var(--mantine-color-gray-3)"}}>
                <Group gap="xs" wrap="nowrap">
                    <VehicleStatusBadge vehicle={vehicle}/>
                    <Text ff="monospace" size="sm" className="sentry-mask">{vehicle.imat}</Text>
                    <Text size="sm" c="dimmed">·</Text>
                    <Text ff="monospace" size="sm">{humanizeNumber(vehicle.kilometer)} km</Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                    <Button variant="outline" h={40} style={{flex: 1}} leftSection={<IconInfoCircle size={18}/>} onClick={openInfo} aria-expanded={infoOpened}>
                        Informations
                    </Button>
                    <Button variant="outline" h={40} style={{flex: 1}} leftSection={<IconDots size={18}/>} onClick={openActions} aria-expanded={actionsOpened}>
                        Actions
                    </Button>
                </Group>
            </Stack>

            <Drawer opened={infoOpened} onClose={closeInfo} position="bottom" title="Informations">
                <VehicleCard vehicle={vehicle} withEdit title={<></>} footer={infoFooter?.(closeInfo)} style={{boxShadow: "none", padding: 0}}/>
            </Drawer>

            <Drawer opened={actionsOpened} onClose={closeActions} position="bottom" title="Actions">
                <div onClick={closeOnButton}>
                    <VehicleActions vehicle={vehicle} style={{boxShadow: "none", padding: 0}}/>
                </div>
            </Drawer>
        </>
    );
};

export default VehicleMobileHeader;
