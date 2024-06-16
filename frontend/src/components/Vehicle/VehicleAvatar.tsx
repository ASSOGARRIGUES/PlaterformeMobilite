import {Vehicle} from "../../types/vehicle";
import {Avatar, AvatarProps, Image, useMantineTheme} from "@mantine/core";
import carIcon from "../../assets/car.svg";
import scooterIcon from "../../assets/scooter.svg";
import {TypeEnum} from "../../types/schema.d";


const VehicleAvatar = ({ vehicle, ...avatarProps}: { vehicle: Vehicle } & Omit<AvatarProps, "props">) => {

    const theme = useMantineTheme();

    const defaultIcon = vehicle?.type === TypeEnum.scouter ? scooterIcon : carIcon;

    return (
        <Avatar src={vehicle?.photo} alt="Véhicule" size={120} radius={60} color={theme.colors.blue[5]} {...avatarProps}>
            <Image src={defaultIcon} alt="Véhicule"/>
        </Avatar>
    )
}

export default VehicleAvatar;