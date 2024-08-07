import {Vehicle} from "../../types/vehicle";
import {useGetToPath, useGo, useResource} from "@refinedev/core";
import {Anchor} from "@mantine/core";

const vehicleBadge = ({vehicle, noLink, noColor}: {vehicle: Vehicle | undefined, noLink?: boolean, noColor?:boolean}) => {
    const go = useGo();
    const getToPath = useGetToPath();
    const { select } = useResource();

    const path = getToPath({
        resource: select("vehicle").resource,
        action: "show",
        meta: {
            id: vehicle?.id
        }
    })

    const click = (e: React.MouseEvent) => {
        go({to: path})
    }

    const content =(
        <span> {vehicle?.fleet_id} - {vehicle?.brand} {vehicle?.modele} {!noColor && (vehicle?.color ?? "")} </span>
    )

    if(noLink){
        return content
    }

    return (
        <Anchor onClick={(e) => {e.stopPropagation(); click(e)}} inherit>
            {content}
        </Anchor>
    );
}


export default vehicleBadge;