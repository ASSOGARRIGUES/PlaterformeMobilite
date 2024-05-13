import {Show} from "@refinedev/mantine";
import {Anchor, Button, Center, Divider, Group, Paper, Skeleton, Stack, Text, Title, Tooltip} from "@mantine/core";
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

const ContractShow = () => {

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;

    const {handlePayContract} = usePayContract()

    const { queryResult: showResponse } = useShow<Contract>()

    const contractResponse  = showResponse.data?.data as Contract | undefined;
    let completeContract = contractResponse? {...contractResponse} as CompleteContract : undefined;


    //Retrieve the beneficiary from the contract using useOne hook
    const {data: beneficiary} = useOne<Beneficiary>({
        resource: "beneficiary",
        id: contractResponse?.beneficiary
    })

    //Update the contract with the beneficiary
    if(completeContract && beneficiary) completeContract.beneficiary = beneficiary.data;


    //Retrieve the vehicle from the contract using useOne hook
    const {data: vehicle} = useOne<Vehicle>({
        resource: "vehicle",
        id: contractResponse?.vehicle
    })

    //Update the contract with the vehicle
    if(completeContract && vehicle) completeContract.vehicle = vehicle.data;

    const benefTitle = beneficiary?.data ? <BeneficiaryBadge beneficiary={beneficiary.data}/> : (<>"Bénéficiaire"</>)

    const openPayModal = async () => {
        if(!completeContract) return;
        const contract_id = completeContract.id;

        openConfirmModal({
            title: "Marquer le contrat comme payé",
            children: (
                <Text>Êtes-vous certain de vouloir marquer ce contrat comme payé ?</Text>
            ),
            labels: {confirm: "Oui", cancel: "Non"},
            onConfirm: () => {handlePayContract(contract_id)}
        });
    };

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
            id: vehicle?.data?.id
        }
    })

    const vehicleTitle = (
       <Anchor onClick={(e) => {e.stopPropagation(); go({to:path})}}>
           Véhicule
       </Anchor>
    )

    return (
        <>
            <EndContractModal {...endModalForm}/>

            <Stack style={{height:"100%"}} >

                <Show title={<Title><ContractBadge contract={completeContract}/> </Title>} contentProps={{style:{padding:0}}}/>

                <Group grow style={{alignItems:"stretch"}}>
                    <BeneficiaryCard style={{flex:"1 1 8%", minWidth:"290px", maxWidth:"100%"}} beneficiary={beneficiary?.data} title={benefTitle}/>

                    <VehicleCard style={{flex:"1 1 30%", minWidth:"432px", maxWidth:"100%"}} vehicle={vehicle?.data} title={vehicleTitle} withEdit={false}/>

                    <ContractCard style={{flex:"1 1 30%", minWidth:"420px", maxWidth:"100%"}} contract={completeContract} withEdit/>
                </Group>

                <Group grow style={{flex:"auto", alignItems:"stretch"}} >
                    <Paper style={{flexGrow:2, maxWidth:"100%"}}>
                        <Stack style={{height: "100%", margin:"0 0.6em"}}>
                            <Center><Title order={3}>Commentaires</Title></Center>
                            <ContractComment style={{flex:"auto"}} contract={completeContract}/>
                        </Stack>
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
                                    <Tooltip label="Ce contrat ne peut être clôturé car il n'est pas actuellement en cours." disabled={completeContract?.status==ContractStatusEnum.pending}>
                                        <span style={{flex:"auto"}}>
                                            <Button style={{width:"100%"}} color="red" variant="outline" onClick={()=>showEndModal(completeContract?.id)} disabled={completeContract?.status!=ContractStatusEnum.pending}>
                                                Clôturer le contrat
                                            </Button>
                                        </span>
                                    </Tooltip>

                                    <Tooltip label="Le statut actuel du contrat ne permet pas l'enregistrement du paiement" disabled={completeContract?.status==ContractStatusEnum.over}>
                                        <span style={{flex:"auto"}}>
                                            <Button style={{width:"100%"}}  color="blue" variant="outline" onClick={openPayModal} disabled={completeContract?.status!=ContractStatusEnum.over}>
                                                Marqué comme payé
                                            </Button>
                                        </span>
                                    </Tooltip>
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