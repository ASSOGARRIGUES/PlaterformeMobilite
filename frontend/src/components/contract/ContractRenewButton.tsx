import {Button, Tooltip} from "@mantine/core";
import {useGo} from "@refinedev/core";
import {Contract} from "../../types/contract";
import {ContractStatusEnum} from "../../types/schema.d";
import {IconRefresh} from "@tabler/icons-react";

const ContractRenewButton = ({contract}: {contract: Contract | undefined}) => {
    const go = useGo();

    const isRenewable = contract?.status === ContractStatusEnum.pending && !contract?.active_renewal_id;

    const tooltipLabel = !contract
        ? ""
        : contract.active_renewal_id
            ? "Ce contrat a déjà un renouvellement en cours."
            : "Ce contrat ne peut pas être renouvelé car il n'est pas en cours.";

    return (
        <Tooltip label={tooltipLabel} disabled={isRenewable}>
            <span style={{flex: "auto"}}>
                <Button
                    style={{width: "100%"}}
                    color="blue"
                    variant="outline"
                    leftSection={<IconRefresh size={16}/>}
                    disabled={!isRenewable}
                    onClick={() => go({to: `/contract/renew/${contract?.id}`})}
                >
                    Renouveler le contrat
                </Button>
            </span>
        </Tooltip>
    );
};

export default ContractRenewButton;
