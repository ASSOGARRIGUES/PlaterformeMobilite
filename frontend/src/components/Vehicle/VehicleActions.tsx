import {Button, Paper, Stack} from "@mantine/core";
import {Vehicle} from "../../types/vehicle";
import ParkingSelect from "./ParkingSelect";
import {CSSProperties} from "react";
import ParkingChangeSelect from "./ParkingChangeSelect";
import QuickStatusButton from "./QuickStatusButton";
import ArchiveButton from "../ArchiveButton";
import VehicleArchiveButton from "./VehicleArchiveButton";
import VehicleTransferButton from "./VehicleTransferButton";
import CanAccess from "../CanAccess";
import {IconTool} from "@tabler/icons-react";
import {useGo, useList} from "@refinedev/core";
import {InterventionSheet} from "../../types/garage";

const VehicleActions = ({ vehicle, style}: { vehicle: Vehicle  | undefined, style?:CSSProperties}) => {
    const go = useGo();

    const { data: openSheets } = useList<InterventionSheet>({
        resource: 'garage/intervention',
        filters: [
            { field: 'vehicle', operator: 'eq', value: vehicle?.id },
            { field: 'status', operator: 'eq', value: 'open' },
        ],
        pagination: { pageSize: 1 },
        queryOptions: { enabled: vehicle?.id != null },
    })
    const openSheet = openSheets?.data?.[0]

    return (
        <Paper shadow="sm" p="md" style={{...style}} >
            <Stack>
                <CanAccess permKey="garage.manage_intervention">
                    <Button
                        leftSection={<IconTool size={18}/>}
                        disabled={vehicle?.archived}
                        onClick={() => go({to: openSheet ? `/garage/intervention/${openSheet.id}` : `/garage/intervention/create?vehicle=${vehicle?.id}`})}
                    >
                        {openSheet ? "Continuer l'intervention" : "Nouvelle intervention"}
                    </Button>
                </CanAccess>
                <QuickStatusButton vehicle={vehicle} disabled={vehicle?.archived}/>
                <ParkingChangeSelect vehicle={vehicle} disabled={vehicle?.archived}/>
                <VehicleArchiveButton vehicle={vehicle}/>
                <VehicleTransferButton vehicle={vehicle}/>
            </Stack>
        </Paper>
    )
}

export default VehicleActions;