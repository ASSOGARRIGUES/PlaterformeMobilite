import ArchiveButton from "../ArchiveButton";
import {Vehicle} from "../../types/vehicle";
import VehicleBadge from "./VehicleBadge";


const VehicleArchiveButton = ({vehicle}: {vehicle: Vehicle | undefined}) => {

    const modalContent = (
        <div>
            Vous êtes sur le point d'archiver le véhicule <VehicleBadge vehicle={vehicle} noLink/><br/>
            Cette action est <i><b>irréversible</b></i> et entrainera l'archivage de <u>l'ensemble</u> des contrats reliés.<br/>
            <p>Êtes-vous certain de vouloir continuer ?</p>
        </div>
    )

    return (
        <ArchiveButton id={vehicle?.id} ressource={"vehicle"} modalContent={modalContent} color="red" disabled={vehicle?.archived}/>
    )
}

export default VehicleArchiveButton;