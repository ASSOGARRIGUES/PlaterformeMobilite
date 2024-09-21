import {Beneficiary} from "../../types/beneficiary";
import {ActionIcon, Center, Flex, Group, Paper, Skeleton, Stack, Title} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";
import useBeneficiaryModalForm from "../../hooks/beneficiary/useBeneficiaryModalForm";
import BeneficiaryModal from "./BeneficiaryModal";
import {CSSProperties, ReactElement} from "react";
import EditButton from "../EditButton";

const BeneficiaryCard = ({beneficiary, withEdit = false, withName = false, title=(<>Informations</>), style}: {beneficiary: Beneficiary | undefined, withEdit?: boolean, withName?:boolean, title?: ReactElement, style?:CSSProperties}) =>{

    const editModalForm = useBeneficiaryModalForm({action: "edit"});
    const {modal: { show: showEditModal },  } = editModalForm;

    const edit = withEdit && beneficiary ? <EditButton record={beneficiary} showEditModal={showEditModal} disabled={beneficiary.archived} permKey='api.change_beneficiary'/> : ""

    const skeleton = (
        <>
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
        </>
    )

    const content = (
        <Group align="start">
            <Stack gap={0}>
                {withName &&
                    <>
                        <div><span style={{fontWeight: "bold"}}>Nom:</span> {beneficiary?.last_name}</div>
                        <div><span style={{fontWeight: "bold"}}>Prénom:</span> {beneficiary?.first_name}</div>
                    </>
                }
                <Flex direction="row">
                    <span style={{fontWeight: "bold"}}>Adresse: </span>
                    <Flex direction="column" style={{marginLeft:7}}>
                        <span>{beneficiary?.address}</span>
                        {beneficiary?.address_complement ?? <span>{beneficiary?.address_complement}</span>}
                        <Flex>{beneficiary?.postal_code} {beneficiary?.city}</Flex>
                    </Flex>

                </Flex>
            </Stack>
            <Stack gap={0}>
                <div><span style={{fontWeight: "bold"}}>Email:</span> <a href={`mailto:${beneficiary?.email}`}>{beneficiary?.email}</a></div>
                <div><span style={{fontWeight: "bold"}}>Téléphone:</span> <a href={`tel:${beneficiary?.phone}`}>{beneficiary?.phone}</a></div>
                <div><span style={{fontWeight: "bold"}}>Numéro de permis:</span> {beneficiary?.license_number!=="" ? beneficiary?.license_number : "pas de permis"}</div>

            </Stack>
        </Group>
    )

    return (
        <>
            <BeneficiaryModal {...editModalForm}/>

            <Paper shadow="sm" p="md" style={style}>
                <Flex direction="column" align="center" gap="xs">
                    <span style={{display: "inline-flex"}}><Title style={{marginRight: "0.2em"}} order={2} >{title}</Title>{edit}</span>
                    {beneficiary ? content : skeleton}
                </Flex>
            </Paper>
        </>
    );
}

export default BeneficiaryCard;