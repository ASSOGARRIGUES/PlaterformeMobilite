import {Vehicle} from "../../types/vehicle";
import {
    ActionIcon,
    Avatar,
    Center,
    Flex,
    Group,
    Image,
    Paper, SimpleGrid,
    Skeleton,
    Stack, Text,
    Title,
    useMantineTheme
} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";
import useVehicleModalForm from "../../hooks/vehicle/useVehicleModalForm";
import VehicleModal from "./VehicleModal";
import carIcon from "../../assets/car.svg";
import {VehicleStatusEnum} from "../../types/schema.d";
import {CSSProperties} from "react";
import {humanizeNumber} from "../../constants";
import VehicleStatusBadge from "./VehicleStatusBadge";

const VehicleCard = ({vehicle, withEdit=false, title="Informations", style}: {vehicle: Vehicle | undefined, withEdit?: boolean, title?:string, style?:CSSProperties}) => {

    const editModalForm = useVehicleModalForm({action: "edit"});
    const {modal: { show: showEditModal},  getInputProps} = editModalForm;

    const theme = useMantineTheme();

    const EditButton = ({vehicle}: {vehicle: Vehicle}) => {
        return (
            <Center>
                <ActionIcon onClick={(e)=>{e.stopPropagation();showEditModal(vehicle.id)}}  color="blue">
                    <IconEdit size={25} />
                </ActionIcon>
            </Center>
        )
    }

    const edit = withEdit && vehicle ? <EditButton vehicle={vehicle}/> : ""

    const skeleton = (
        <>
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
        </>
    )

    const content = vehicle ? (
        <Group align="start" position="center">
            <Avatar src={vehicle?.photo} alt="it's me" size={120} radius={60} color={theme.colors.gray[1]}>
                <Image src={carIcon} alt="Voiture"/>
            </Avatar>
            <SimpleGrid cols={2} verticalSpacing={0}>
                <Text><span style={{fontWeight: "bold"}}>Numéro de flotte: </span> {vehicle?.fleet_id}</Text>
                <Text><span style={{fontWeight: "bold"}}>Statut: </span> <VehicleStatusBadge vehicle={vehicle}/></Text>
                <Text><span style={{fontWeight: "bold"}}>Type: </span> {vehicle?.type}</Text>
                <Text><span style={{fontWeight: "bold"}}>Marque: </span> {vehicle?.brand}</Text>
                <Text><span style={{fontWeight: "bold"}}>Modèle: </span> {vehicle?.modele}</Text>
                <Text><span style={{fontWeight: "bold"}}>Année: </span> {vehicle?.year}</Text>
                <Text><span style={{fontWeight: "bold"}}>Immatriculation: </span> {vehicle?.imat}</Text>
                <Text><span style={{fontWeight: "bold"}}>Kilométrage: </span> {humanizeNumber(vehicle?.kilometer)}km</Text>
                <Text><span style={{fontWeight: "bold"}}>Transmission: </span> {vehicle?.transmission}</Text>
                <Text><span style={{fontWeight: "bold"}}>Carburant: </span> {vehicle?.fuel_type}</Text>

            </SimpleGrid>
        </Group>
    ): skeleton;


    return (
        <>
            <VehicleModal {...editModalForm}/>

            <Paper shadow="sm" p="md" style={style}>
                <Flex direction="column" align="center" gap="xs">
                    <Title order={2}>{title} {edit}</Title>
                    {vehicle ? content : skeleton}
                </Flex>
            </Paper>
        </>
    );

}

export default VehicleCard;