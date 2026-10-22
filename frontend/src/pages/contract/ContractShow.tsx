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
    useMantineTheme,
    Title,
    Tooltip
} from "@mantine/core";
import {useShow} from "@refinedev/core";
import {useSearchParams} from "react-router-dom";
import {useMediaQuery} from "@mantine/hooks";
import {Contract} from "../../types/contract";
import ContractCard from "../../components/contract/ContractCard";
import ContractBadge from "../../components/contract/ContractBadge";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import VehicleCard from "../../components/Vehicle/VehicleCard";
import BeneficiaryCard from "../../components/beneficiary/BeneficiaryCard";
import ContractPDFButton from "../../components/contract/ContractPDFButton";
import BillPDFButton from "../../components/contract/BillPDFButton";
import EndContractModal from "../../components/contract/EndContractModal";
import useEndContractForm from "../../hooks/useEndContractForm";
import {ContractStatusEnum} from "../../types/schema.d";
import usePayContract from "../../hooks/contract/usePayContract";
import ContractComment from "../../components/contract/ContractComment";
import {useGetToPath, useGo, useResource} from "@refinedev/core";
import ContractArchiveButton from "../../components/contract/ContractArchiveButton";
import {IconCalendarEvent, IconClipboardCheck, IconHistory, IconMessageCircle, IconReceiptEuro} from "@tabler/icons-react";
import {InspectionsPanel} from "../../components/garage/inspection/InspectionsPanel";
import {MobileTabLabel, MOBILE_TAB_STYLE} from "../../components/garage/MobileTabLabel";
import {humanizeDate} from "../../constants";
import ContractRenewalTimeline from "../../components/contract/ContractRenewalTimeline";
import ContractRenewButton from "../../components/contract/ContractRenewButton";
import PaymentTable from "../../components/contract/PaymentTable";
import PaymentSummary from "../../components/contract/PaymentSummary";
import ContractNewPaymentButton from "../../components/contract/ContractNewPaymentButton";
import {Show} from "../../components/forkedFromRefine/Show";
import CanAccess from "../../components/CanAccess";
import ContractDeleteButton from "../../components/contract/ContractDeleteButton";

const ContractShow = () => {

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;

    const {handlePayContract} = usePayContract()

    const theme = useMantineTheme();
    const isMobile = !!useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, false, {getInitialValueInEffect: false});
    // ?tab=inspections : retour depuis le détail d'un contrôle sur l'onglet Contrôles
    const [searchParams] = useSearchParams();

    const { queryResult: showResponse } = useShow<Contract>()

    const contractResponse  = showResponse.data?.data as Contract | undefined;

    const beneficiary = contractResponse?.beneficiary
    const vehicle = contractResponse?.vehicle



    function skeleton(nb:number){
        return Array.from({length: nb}, (_, i) => (
            <Paper key={i} shadow="sm" p="md" style={{marginBottom:10}}>
                <Stack gap="md">
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

    const benefTitle = beneficiary ? <BeneficiaryBadge beneficiary={beneficiary}/> : (<>"Bénéficiaire"</>)

    const vehicleTitle = (
        <Anchor onClick={(e) => {e.stopPropagation(); go({to:path})}} inherit>
            Véhicule
        </Anchor>
    )

    const tabLabel = (icon: React.ReactNode, label: string, mobileLabel = label) => isMobile ? <MobileTabLabel icon={icon} label={mobileLabel}/> : label;
    const tabStyle = isMobile ? MOBILE_TAB_STYLE : undefined;
    const ongoing = contractResponse?.status !== ContractStatusEnum.over && contractResponse?.status !== ContractStatusEnum.payed;

    const tabsBlock = contractResponse ? (
        <Tabs
            variant="outline"
            style={{
                display: "flex",
                flexDirection:"column",
                flex: "1 1 auto",
            }}
            defaultValue={searchParams.get('tab') === 'inspections' ? "inspections" : contractResponse.status==ContractStatusEnum.pending ? "comment" : "payments"}
            keepMounted={false}
        >
            <Tabs.List grow={isMobile} style={isMobile ? {flexWrap: "nowrap"} : undefined}>
                <Tabs.Tab leftSection={isMobile ? undefined : <IconMessageCircle size={18} />} style={tabStyle} value={"comment"}>{tabLabel(<IconMessageCircle size={20}/>, "Commentaire d'équipe", "Commentaire")}</Tabs.Tab>
                <CanAccess permKey={'api.view_payment'}><Tabs.Tab leftSection={isMobile ? undefined : <IconReceiptEuro size={18}/>} style={tabStyle} value={"payments"}>{tabLabel(<IconReceiptEuro size={20}/>, "Paiements")}</Tabs.Tab></CanAccess>
                <Tabs.Tab leftSection={isMobile ? undefined : <IconHistory size={18}/>} style={tabStyle} value={"history"}>{tabLabel(<IconHistory size={20}/>, "Historique")}</Tabs.Tab>
                <CanAccess permKey={'garage.view_vehicle'}><Tabs.Tab leftSection={isMobile ? undefined : <IconClipboardCheck size={18}/>} style={tabStyle} value={"inspections"}>{tabLabel(<IconClipboardCheck size={20}/>, "Contrôles")}</Tabs.Tab></CanAccess>
            </Tabs.List>

            <Tabs.Panel style={{flex: "1 1 auto"}} value={"comment"}>
                <Stack style={{height: "100%", margin:"0 0.6em"}}>
                    <Center><Title order={3}>Commentaires</Title></Center>
                    <ContractComment style={{flex:"auto"}} contract={contractResponse}/>
                </Stack>
            </Tabs.Panel>

            <CanAccess permKey={'api.view_payment'}>
                <Tabs.Panel value="payments" style={{flex: "1 1 auto"}}>
                    <Stack style={{height: "100%", margin:"0.2em 0.6em"}}>
                        <PaymentTable contract={contractResponse}/>
                        <PaymentSummary contract={contractResponse}/>
                    </Stack>
                </Tabs.Panel>
            </CanAccess>

            <Tabs.Panel value="history" style={{flex: "1 1 auto"}}>
                <ContractRenewalTimeline contract={contractResponse}/>
            </Tabs.Panel>

            <CanAccess permKey={'garage.view_vehicle'}>
                <Tabs.Panel value="inspections" style={{flex: "1 1 auto"}} p="md">
                    <InspectionsPanel
                        origin="contract"
                        originId={contractResponse.id}
                        context={vehicle && (
                            <Group gap={10} wrap="nowrap" align="flex-start" p="xs" bg="gray.0" style={{borderRadius: 10}}>
                                <IconCalendarEvent size={19} color="var(--mantine-color-dimmed)" aria-hidden style={{flexShrink: 0, marginTop: 1}}/>
                                <Text fz={13.5} lh={1.45}>
                                    Contrôles du véhicule <b>{vehicle.brand} {vehicle.modele}</b> <Text component="span" ff="monospace" fz={12.5} className="sentry-mask">{vehicle.imat}</Text>
                                    {" "}pendant le contrat, du {humanizeDate(contractResponse.start_date)} {ongoing ? "à aujourd'hui (contrat en cours)." : `au ${humanizeDate(contractResponse.end_date)}.`}
                                </Text>
                            </Group>
                        )}
                    />
                </Tabs.Panel>
            </CanAccess>
        </Tabs>
    ) : skeleton(2);

    return (
        <>
            <EndContractModal {...endModalForm}/>

            <Stack style={{height:"100%"}} >

                <Show title={<Title><ContractBadge contract={contractResponse} /> </Title>} contentProps={{style:{padding:0}}}/>

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
                                <Group>
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

                                    <ContractRenewButton contract={contractResponse}/>

                                    <ContractArchiveButton contract={contractResponse}/>
                                    <ContractDeleteButton contract={contractResponse}/>
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