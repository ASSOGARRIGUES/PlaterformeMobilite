import {CompleteContract} from "../../types/contract";
import {Badge, Tooltip} from "@mantine/core";
import {ContractStatusEnum} from "../../types/schema.d";
import {contractStatusLabelMap} from "../../constants";

const ContractStatusBadge = ({contract}: {contract: CompleteContract}) => {

    if(contract.archived) return (<Badge color="gray">Archivé</Badge>);

    const status = contract.status as keyof typeof ContractStatusEnum;

    const statusColorMap: Record<string, string> = {
        [ContractStatusEnum.waiting]: "orange",
        [ContractStatusEnum.pending]: "teal",
        [ContractStatusEnum.over]: "red",
        [ContractStatusEnum.payed]: "gray",
    }

    const tooltipTextMap: Record<string, string> = {
        [ContractStatusEnum.waiting]: "En attente d'Etat des lieux",
        [ContractStatusEnum.pending]: "En cours: véhicule à disposition",
        [ContractStatusEnum.over]: "Clôturer: véhicule rendu, contrat en attente de paiement",
        [ContractStatusEnum.payed]: "Payé: contrat terminé",
    }

    return <Tooltip label={tooltipTextMap[status]}><Badge color={statusColorMap[status]}>{contractStatusLabelMap[status]}</Badge></Tooltip>
}

export default ContractStatusBadge;