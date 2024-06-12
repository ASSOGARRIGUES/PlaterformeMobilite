import {Flex, Group, Paper, SimpleGrid, Skeleton, Text, Title, useMantineTheme} from "@mantine/core";
import {ContractStatusEnum} from "../../types/schema.d";
import {CompleteContract} from "../../types/contract";
import useContractModalForm from "../../hooks/contract/useContractModalForm";
import ContractStatusBadge from "./ContractStatusBadge";
import ContractModal from "./ContractModal";
import {humanizeDate, humanizeFirstName, humanizeLastName, humanizeNumber} from "../../constants";
import {CSSProperties} from "react";
import ContractEditButton from "./ContractEditButton";

const ContractCard = ({contract, withEdit=false, style}: {contract: CompleteContract | undefined, withEdit?: boolean, style?:CSSProperties}) => {

    const editModalForm = useContractModalForm({action: "edit"});
    const {modal: { show: showEditModal},  getInputProps} = editModalForm;

    const theme = useMantineTheme();


    const edit = withEdit && contract ? <ContractEditButton  contract={contract} showEditModal={showEditModal}/> : ""

    const skeleton = (
        <>
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
        </>
    )

    const remainingDays = (contract: CompleteContract) => {
        const end = new Date(contract.end_date);
        const today = new Date();
        const diff = end.getTime() - today.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    }

    const remainingDaysColor = contract && remainingDays(contract) < 0 ? theme.colors.red[6] : theme.colors.dark[9];

    const kmFinalMax = contract && contract.start_kilometer ? contract.start_kilometer + (contract.max_kilometer as number) : 0;
    const kmFinalColor = contract && contract.end_kilometer && contract.end_kilometer > kmFinalMax ? theme.colors.red[6] : theme.colors.dark[9];

    const content = contract ? (
        <Group align="start">
            <SimpleGrid cols={2} verticalSpacing={1}>
                <Text><span style={{fontWeight: "bold"}}>Numéro contrat: </span> {contract.id }</Text>
                <Text><span style={{fontWeight: "bold"}}>Status: </span> {<ContractStatusBadge contract={contract}/> }</Text>
                <Text><span style={{fontWeight: "bold"}}>Créé le: </span> {humanizeDate(contract.created_at)} </Text>
                <Text><span style={{fontWeight: "bold"}}>Par: </span> { contract.created_by?.first_name && contract.created_by?.last_name ? humanizeFirstName(contract.created_by.first_name)+" "+contract.created_by.last_name.substring(1,0).toUpperCase()+"." : "--"} </Text>
                <Text><span style={{fontWeight: "bold"}}>Début: </span> {humanizeDate(contract.start_date)} </Text>
                <Text><span style={{fontWeight: "bold"}}>Référent: </span> { contract.referent?.first_name && contract.referent?.last_name ? humanizeFirstName(contract.referent.first_name)+" "+contract.referent.last_name.substring(1,0).toUpperCase()+"." : "--"} </Text>
                <Text><span style={{fontWeight: "bold"}}>Fin: </span> {humanizeDate(contract.end_date)}</Text>
                <Text><span style={{fontWeight: "bold"}}>Prix: </span> {contract.price}€</Text>
                <Text><span style={{fontWeight: "bold"}}>Temps restant: </span> <span style={{color: remainingDaysColor}}>{ remainingDays(contract)}j</span></Text>
                <Text><span style={{fontWeight: "bold"}}>Caution: </span> {contract.deposit}€</Text>

                <Text><span style={{fontWeight: "bold"}}>Km initial: </span> {contract.start_kilometer? humanizeNumber(contract.start_kilometer) : "---"}km</Text>
                <Text><span style={{fontWeight: "bold"}}>Remise: </span> {contract.discount}€</Text>
                <Text><span style={{fontWeight: "bold"}}>distance max: </span> {contract.max_kilometer && humanizeNumber(contract.max_kilometer)}km</Text>
                <Text><span style={{fontWeight: "bold"}}>Km max final: </span> {humanizeNumber(kmFinalMax)}km</Text>

                {(contract && (contract?.status === ContractStatusEnum.over || contract?.status === ContractStatusEnum.payed)) && (
                    <>
                        <Text><span style={{fontWeight: "bold"}}>Cloturé le: </span> {contract.ended_at && humanizeDate(contract.ended_at)} </Text>
                        <Text><span style={{fontWeight: "bold"}}>Km final: </span> <span style={{color: kmFinalColor}}>{humanizeNumber(contract?.end_kilometer)}km</span></Text>
                    </>
                )}



            </SimpleGrid>
        </Group>
    ): (<></>)


    return (
        <>
            <ContractModal {...editModalForm}/>

            <Paper shadow="sm" p="md" style={style}>
                <Flex direction="column" align="center" gap="xs">
                    <span style={{display: "inline-flex"}}><Title style={{marginRight: "0.2em"}} order={2} >Informations</Title>{edit}</span>
                    {contract ? content : skeleton}
                </Flex>
            </Paper>
        </>
    );

}

export default ContractCard;