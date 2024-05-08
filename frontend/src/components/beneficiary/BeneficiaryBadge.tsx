import {Beneficiary} from "../../types/beneficiary";
import {Anchor} from "@mantine/core";
import {IResourceItem, useGetToPath, useGo, useResource} from "@refinedev/core";

const BeneficiaryBadge = ({ beneficiary }: { beneficiary: Beneficiary }) => {

    const go = useGo();
    const getToPath = useGetToPath();
    const { select } = useResource();

    const path = getToPath({
        resource: select("beneficiary").resource,
        action: "show",
        meta: {
            id: beneficiary.id
        }
    })

    const click = (e: React.MouseEvent) => {
        go({to: path})
    }

    return (
        <Anchor onClick={(e) => {e.stopPropagation(); click(e)}}>
            {beneficiary.first_name} {beneficiary.last_name}
        </Anchor>
    );

}

export default BeneficiaryBadge;