import {Vehicle} from "../../types/vehicle";
import {
    Flex,
    Group,
    Paper, SimpleGrid,
    Skeleton,
    Text,
    Title,
    useMantineTheme
} from "@mantine/core";
import useVehicleModalForm from "../../hooks/vehicle/useVehicleModalForm";
import VehicleModal from "./VehicleModal";
import {CSSProperties} from "react";
import {humanizeNumber, vehicleTypeLabelMap} from "../../constants";
import VehicleStatusBadge from "./VehicleStatusBadge";
import VehicleAvatar from "./VehicleAvatar";
import EditButton from "../EditButton";

const VehicleCard = ({vehicle, withEdit=false, title=(<>Informations</>), style}: {vehicle: Vehicle | undefined, withEdit?: boolean, title?:React.ReactElement, style?:CSSProperties}) => {

    const editModalForm = useVehicleModalForm({action: "edit"});
    const {modal: { show: showEditModal},  getInputProps} = editModalForm;


    const edit = withEdit && vehicle ? <EditButton showEditModal={showEditModal} record={vehicle} disabled={vehicle.archived} permKey='api.change_vehicle'/> : ""

    const skeleton = (
        <>
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
        </>
    )

    const content = vehicle ? (
        <Group align="start" justify="center">
            <VehicleAvatar vehicle={vehicle} size={120} radius={60}/>
            <SimpleGrid cols={2} verticalSpacing={0}>
                <Text><span style={{fontWeight: "bold"}}>Numéro de flotte: </span> {vehicle?.fleet_id}</Text>
                <Group style={{alignItems:"center"}}>
                    <Text><span style={{fontWeight: "bold"}}>Statut: </span></Text>
                    <VehicleStatusBadge vehicle={vehicle}/>
                </Group>
                <Text><span style={{fontWeight: "bold"}}>Type: </span> {vehicle?.type ? vehicleTypeLabelMap[vehicle?.type] : "Inconnu"}</Text>
                <Text><span style={{fontWeight: "bold"}}>Marque: </span> {vehicle?.brand}</Text>
                <Text><span style={{fontWeight: "bold"}}>Modèle: </span> {vehicle?.modele}</Text>
                <Text><span style={{fontWeight: "bold"}}>Couleur: </span> {vehicle?.color}</Text>
                <Text><span style={{fontWeight: "bold"}}>Année: </span> {vehicle?.year}</Text>
                <Text><span style={{fontWeight: "bold"}}>Immatriculation: </span> {vehicle?.imat}</Text>
                <Text><span style={{fontWeight: "bold"}}>Kilométrage: </span> {humanizeNumber(vehicle?.kilometer)}km</Text>
                <Text><span style={{fontWeight: "bold"}}>Transmission: </span> {vehicle?.transmission}</Text>
                <Text><span style={{fontWeight: "bold"}}>Carburant: </span> {vehicle?.fuel_type}</Text>
                <Text><span style={{fontWeight: "bold"}}>Action: </span>{vehicle?.action.name}</Text>

            </SimpleGrid>
        </Group>
    ): skeleton;


    return (
        <>
            <VehicleModal {...editModalForm}/>

            <Paper shadow="sm" p="md" style={style}>
                <Flex direction="column" align="center" gap="xs">
                    <span style={{display: "inline-flex"}}><Title style={{marginRight: "0.2em"}} order={2} >{title}</Title>{edit}</span>
                    {vehicle ? content : skeleton}
                </Flex>
            </Paper>
        </>
    );

}

export default VehicleCard;