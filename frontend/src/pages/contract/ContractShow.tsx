import {Show} from "@refinedev/mantine";
import {
    Anchor,
    Button,
    Center,
    Divider,
    Group,
    Paper,
    Skeleton,
    Stack,
    Tabs,
    Text,
    Title,
    Tooltip
} from "@mantine/core";
import {useOne, useShow} from "@refinedev/core";
import {CompleteContract, Contract} from "../../types/contract";
import ContractCard from "../../components/contract/ContractCard";
import ContractBadge from "../../components/contract/ContractBadge";
import {Beneficiary} from "../../types/beneficiary";
import {Vehicle} from "../../types/vehicle";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import VehicleCard from "../../components/Vehicle/VehicleCard";
import BeneficiaryCard from "../../components/beneficiary/BeneficiaryCard";
import ContractPDFButton from "../../components/contract/ContractPDFButton";
import BillPDFButton from "../../components/contract/BillPDFButton";
import EndContractModal from "../../components/contract/EndContractModal";
import useEndContractForm from "../../hooks/useEndContractForm";
import {ContractStatusEnum} from "../../types/schema.d";
import {openConfirmModal} from "@mantine/modals";
import usePayContract from "../../hooks/contract/usePayContract";
import ContractComment from "../../components/contract/ContractComment";
import {useGetToPath, useGo, useResource} from "@refinedev/core";
import {User} from "../../types/auth";
import ArchiveButton from "../../components/ArchiveButton";
import ContractArchiveButton from "../../components/contract/ContractArchiveButton";
import {IconMessageCircle, IconReceiptEuro} from "@tabler/icons-react";
import PaymentTable from "../../components/contract/PaymentTable";
import PaymentSummary from "../../components/contract/PaymentSummary";
import ContractNewPaymentButton from "../../components/contract/ContractNewPaymentButton";

const ContractShow = () => {

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;

    const {handlePayContract} = usePayContract()

    const { queryResult: showResponse } = useShow<Contract>()

    const contractResponse  = showResponse.data?.data as Contract | undefined;

    const beneficiary = contractResponse?.beneficiary
    const vehicle = contractResponse?.vehicle

    const benefTitle = beneficiary ? <BeneficiaryBadge beneficiary={beneficiary}/> : (<>"Bénéficiaire"</>)

    function skeleton(nb:number){
        return Array.from({length: nb}, (_, i) => (
            <Paper key={i} shadow="sm" p="md" style={{marginBottom:10}}>
                <Stack spacing="md">
                    <Skeleton height={8} radius="xl" />
                    <Skeleton height={8} mt={6} radius="xl" />
                    <Skeleton height={8} mt={6} width="70%" radius="xl" />
                </Stack>
            </Paper>
        ))
    }

    //Vehicle information title with a link to the vehicle show page
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

    const vehicleTitle = (
        <Anchor onClick={(e) => {e.stopPropagation(); go({to:path})}}>
            Véhicule
        </Anchor>
    )

    const tabsBlock = contractResponse ? (
        <Tabs
            variant="outline"
            style={{
                display: "flex",
                flexDirection:"column",
                flex: "1 1 auto",
            }}
            defaultValue={contractResponse.status==ContractStatusEnum.pending ? "comment" : "payments"}
            keepMounted={false}
        >
            <Tabs.List>
                <Tabs.Tab icon={<IconMessageCircle size={18} />} value={"comment"}>Commentaire d'équipe</Tabs.Tab>
                <Tabs.Tab icon={<IconReceiptEuro size={18}/>} value={"payments"}>Paiements</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel style={{flex: "1 1 auto"}} value={"comment"}>
                <Stack style={{height: "100%", margin:"0 0.6em"}}>
                    <Center><Title order={3}>Commentaires</Title></Center>
                    <ContractComment style={{flex:"auto"}} contract={contractResponse}/>
                </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="payments" style={{flex: "1 1 auto"}}>
                <Stack style={{height: "100%", margin:"0.2em 0.6em"}}>
                    <PaymentTable contract={contractResponse}/>
                    <PaymentSummary contract={contractResponse}/>
                </Stack>
            </Tabs.Panel>
        </Tabs>
    ) : skeleton(2);

    return (
        <>
            <EndContractModal {...endModalForm}/>

            <Stack style={{height:"100%"}} >

                <Show title={<Title><ContractBadge contract={contractResponse}/> </Title>} contentProps={{style:{padding:0}}}/>

                <Group grow style={{alignItems:"stretch"}}>
                    <BeneficiaryCard style={{flex:"1 1 8%", minWidth:"290px", maxWidth:"100%"}} beneficiary={beneficiary} title={benefTitle}/>

                    <VehicleCard style={{flex:"1 1 30%", minWidth:"432px", maxWidth:"100%"}} vehicle={vehicle} title={vehicleTitle} withEdit={false}/>

                    <ContractCard style={{flex:"1 1 30%", minWidth:"420px", maxWidth:"100%"}} contract={contractResponse} withEdit/>
                </Group>

                <Group grow style={{flex:"auto", alignItems:"stretch"}} >
                    <Paper style={{flexGrow:2, maxWidth:"100%", display:"flex", flexDirection:"column"}}>
                        {tabsBlock}
                    </Paper>

                    <Paper style={{minWidth:0}}>
                        <Stack>
                            {contractResponse ? (
                                <Stack style={{padding:"0 1.5em", marginTop:"1em"}}>
                                    <Center><Title order={3}>Documents</Title></Center>

                                    <Group grow>
                                        <ContractPDFButton contract={contractResponse} variant="button"/>
                                        <BillPDFButton contract={contractResponse} variant="button"/>
                                    </Group>
                                </Stack>
                            ) : skeleton(1) }

                            <Divider my="sm" />

                            <Stack style={{padding:"0 1.5em"}}>
                                <Center><Title order={3}>Actions</Title></Center>
                                <Group grow>
                                    <Tooltip label="Ce contrat ne peut être clôturé car il n'est pas actuellement en cours." disabled={contractResponse?.status==ContractStatusEnum.pending}>
                                        <span style={{flex:"auto"}}>
                                            <Button style={{width:"100%"}} color="red" variant="outline" onClick={()=>showEndModal(contractResponse?.id)} disabled={contractResponse?.status!=ContractStatusEnum.pending}>
                                                Clôturer le contrat
                                            </Button>
                                        </span>
                                    </Tooltip>

                                    {contractResponse? (
                                        <ContractNewPaymentButton contract={contractResponse} variant="button"/>
                                    ): skeleton(1)}

                                    <ContractArchiveButton contract={contractResponse}/>
                                </Group>
                            </Stack>

                        </Stack>
                    </Paper>

                </Group>

            </Stack>
        </>
    )
}

export default ContractShow;