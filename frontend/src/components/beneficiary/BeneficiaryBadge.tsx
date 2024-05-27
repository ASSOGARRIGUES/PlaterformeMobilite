import {Beneficiary} from "../../types/beneficiary";
import {Anchor} from "@mantine/core";
import {useGetToPath, useGo, useResource} from "@refinedev/core";

const BeneficiaryBadge = ({ beneficiary, noLink }: { beneficiary: Beneficiary | undefined, noLink?:boolean }) => {

    const go = useGo();
    const getToPath = useGetToPath();
    const { select } = useResource();

    const path = getToPath({
        resource: select("beneficiary").resource,
        action: "show",
        meta: {
            id: beneficiary?.id
        }
    })

    const click = (e: React.MouseEvent) => {
        go({to: path})
    }

    const content = (<>{beneficiary?.first_name} {beneficiary?.last_name}</>)

    if(noLink){
        return content
    }

    return (
        <Anchor onClick={(e) => {e.stopPropagation(); click(e)}}>
            {content}
        </Anchor>
    );

}

export default BeneficiaryBadge;