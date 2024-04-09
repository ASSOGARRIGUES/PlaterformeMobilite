import {Vehicle} from "../../types/vehicle";

const vehicleBadge = ({vehicle}: {vehicle: Vehicle | undefined}) => (
    <span> {vehicle?.fleet_id} - {vehicle?.brand} {vehicle?.modele} </span>
);
export default vehicleBadge;