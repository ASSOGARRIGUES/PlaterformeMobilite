import {Beneficiary} from "../../types/beneficiary";
import {ActionIcon, Center, Flex, Group, Paper, Skeleton, Stack, Title} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";
import useBeneficiaryModalForm from "../../hooks/beneficiary/useBeneficiaryModalForm";
import BeneficiaryModal from "./BeneficiaryModal";

const BeneficiaryCard = ({beneficiary, withEdit = false}: {beneficiary: Beneficiary | undefined, withEdit?: boolean}) =>{

    const editModalForm = useBeneficiaryModalForm({action: "edit"});
    const {modal: { show: showEditModal },  } = editModalForm;

    const EditButton = ({beneficiary}: {beneficiary: Beneficiary}) => {
        return (
            <Center>
                <ActionIcon onClick={(e)=>{e.stopPropagation();showEditModal(beneficiary.id)}}  color="blue">
                    <IconEdit size={25} />
                </ActionIcon>
            </Center>
        )
    }

    const edit = withEdit && beneficiary ? <EditButton beneficiary={beneficiary}/> : ""

    const skeleton = (
        <>
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
        </>
    )

    const content = (
        <Group align="start">
            <Flex direction="row">
                <span style={{fontWeight: "bold"}}>Adresse: </span>
                <Flex direction="column" style={{marginLeft:7}}>
                    <span>{beneficiary?.address}</span>
                    {beneficiary?.address_complement ?? <span>{beneficiary?.address_complement}</span>}
                    <Flex>{beneficiary?.postal_code} {beneficiary?.city}</Flex>
                </Flex>
            </Flex>
            <Stack spacing={0}>
                <div><span style={{fontWeight: "bold"}}>Email:</span> <a href={`mailto:${beneficiary?.email}`}>{beneficiary?.email}</a></div>
                <div><span style={{fontWeight: "bold"}}>Téléphone:</span> <a href={`tel:${beneficiary?.phone}`}>{beneficiary?.phone}</a></div>
                <div><span style={{fontWeight: "bold"}}>Numéro de licence:</span> {beneficiary?.license_number}</div>
            </Stack>
        </Group>
    )

    return (
        <>
            <BeneficiaryModal {...editModalForm}/>

            <Paper shadow="sm" p="md">
                <Flex direction="column" align="center" gap="xs">
                    <Title order={2}>Informations {edit}</Title>
                    {beneficiary ? content : skeleton}
                </Flex>
            </Paper>
        </>
    );
}

export default BeneficiaryCard;