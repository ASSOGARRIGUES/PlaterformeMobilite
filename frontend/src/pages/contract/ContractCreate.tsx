import {CompleteContract, ContractWritableFields} from "../../types/contract";
import {BlankEnum, ContractStatusEnum, PaymentModeEnum, ReasonEnum} from "../../types/schema.d";
import {FormErrors, FormValidateInput} from "@mantine/form/lib/types";
import {Create, useSelect, useStepsForm} from "@refinedev/mantine";
import {
    Button, Center, Flex,
    Group,
    Loader,
    NumberInput,
    Paper,
    Select,
    SimpleGrid,
    Stack,
    Stepper,
    Text,
    Title
} from "@mantine/core";
import {SaveButton} from "../../components/SaveButton";
import React, {useEffect, useState} from "react";
import {CrudFilters, useGetIdentity} from "@refinedev/core";
import {
    contractReasonLabelMap,
    DEBOUNCE_TIME,
    humanizeDate,
    humanizeFirstName,
    humanizeNumber,
    paymentModeLabelMap
} from "../../constants";
import {DateRangePicker, DateRangePickerValue} from "@mantine/dates";
import dayjs from "dayjs";
import BeneficiarySelect from "../../components/beneficiary/BeneficiarySelect";
import VehicleSelect from "../../components/Vehicle/VehicleSelect";
import ReferentSelect from "../../components/user/UserSelect";
import {Beneficiary} from "../../types/beneficiary";
import {Vehicle} from "../../types/vehicle";
import {User} from "../../types/auth";
import BeneficiaryCard from "../../components/beneficiary/BeneficiaryCard";
import VehicleCard from "../../components/Vehicle/VehicleCard";
import ContractCard from "../../components/contract/ContractCard";
import vehicleSelect from "../../components/Vehicle/VehicleSelect";
import ContractStatusBadge from "../../components/contract/ContractStatusBadge";
import {IconAlertTriangle} from "@tabler/icons-react";

const ContractCreate = () => {

    const whoAmI = useGetIdentity<User>();
    const [startKilometerDirty, setStartKilometerDirty] = useState(false);

    const initialValues: ContractWritableFields = {
        vehicle: 0,
        beneficiary: 0,
        deposit: 315,
        depositPaymentMode: undefined,
        deposit_check_number: undefined,
        start_kilometer: 0,
        price: 100,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        referent: 0,
        max_kilometer: 0,
        reason: BlankEnum[""],
        discount: 0,
    };

    const validate = (values:ContractWritableFields, currentStep: number): FormErrors => {

        if(currentStep === 0) {
            return {
                vehicle: values.vehicle ? undefined : "Le véhicule est requis",
                beneficiary: values.beneficiary ? undefined : "Le bénéficiaire est requis",
            }
        }

        if(currentStep === 1){
            return {
                price: values.price ? undefined : "Le prix est requis",
                discount: values.discount && values.discount < 0 ? "La remise ne peut pas être négative" : undefined,
                start_date: !values.start_date || !values.end_date ?  "La date de début est requise": (values.start_date >= values.end_date ? "la date de fin doit être supérieure à la date de début" : undefined),
                referent: values.referent ? undefined : "Le référent est requis",
                max_kilometer: values.max_kilometer ? (values.max_kilometer < 0 ? "Le kilométrage maximum ne peut pas être négatif" : undefined) : "Le kilométrage maximum est requis",
                reason: values.reason ? undefined : "La raison est requise",
            }
        }

        if(currentStep === 2){
            return {
                deposit: values.deposit ? (values.deposit < 0 ? "La caution ne peut pas être négative" : undefined) : "La caution est requise",
                depositPaymentMode: values.depositPaymentMode ? undefined : "Le mode de paiement de la caution est requis",
                deposit_check_number: values.depositPaymentMode === PaymentModeEnum.check && !values.deposit_check_number ? "Le numéro de chèque est requis" : undefined,
            }
        }

        return {};
    }

    /*
    ################
    #  MODAL FORM  #
    ################
    */

    const {
        saveButtonProps,
        getInputProps,
        values,
        isDirty,
        errors,
        steps: { currentStep, gotoStep },
    } = useStepsForm({
        initialValues,
        validate: (values) : FormErrors => validate(values, currentStep),
        validateInputOnBlur: true,
        refineCoreProps:{
            redirect: "show"
        },
        transformValues: (values) => {
            return {
                ...values,
                start_kilometer: startKilometerDirty ? values.start_kilometer : undefined,
            }
        }
    })


    const reasonOptions = Object.values(ReasonEnum).map((reason) => ({ value: reason, label: contractReasonLabelMap[reason] }));

    const startDateInputProps = getInputProps("start_date");
    const endDateInputProps = getInputProps("end_date");


    const [dateValue, setDateValue] = React.useState<DateRangePickerValue>([new Date(startDateInputProps.value), new Date(endDateInputProps.value)]);

    function handleDateChange(value: DateRangePickerValue) {
        setDateValue(value);
        startDateInputProps.onChange(dayjs(value[0]).format("YYYY-MM-DD"));
        endDateInputProps.onChange(dayjs(value[1]).format("YYYY-MM-DD"));
    }

    const {value: beneficiaryObj, ...beneficiaryInputProps} = getInputProps("beneficiary");
    const {value: vehicleObj, ...vehicleInputProps} = getInputProps("vehicle");
    const {value: referentObj, ...referentInputProps} = getInputProps("referent");

    const beneficiaryValue = beneficiaryObj?.id || beneficiaryObj;
    const vehicleValue = vehicleObj?.id || vehicleObj;
    const referentValue = referentObj?.id || referentObj;

    const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary>(beneficiaryObj?.id ? beneficiaryObj : undefined)
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>(vehicleObj?.id ? vehicleObj : undefined)
    const [selectedReferent, setSelectedReferent] = useState<User>(referentObj?.id ? referentObj : undefined)

    const paymentModeOptions = Object.values(PaymentModeEnum).map((mode) => ({ value: mode, label: paymentModeLabelMap[mode] }));

    const contractDuration = (contract: ContractWritableFields) => {
        const end = new Date(contract.end_date);
        const start = new Date(contract.start_date);
        const diff = end.getTime() - start.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    }

    useEffect(() => {
        getInputProps("start_kilometer").onChange(selectedVehicle?.kilometer || 0);
    }, [selectedVehicle]);

    useEffect(() => {
        setStartKilometerDirty((selectedVehicle!=undefined && values.start_kilometer !== selectedVehicle.kilometer))
    }, [selectedVehicle, values.start_kilometer]);


    const warningMessage = (
        <Group  style={{display:startKilometerDirty? "flex" : "none"}} align="center">
            <IconAlertTriangle size={35} color="red" />
            <p style={{color:"red", flex:"auto"}}>Le kilométrage initial entré est différent du kilométrage actuellement connu du véhicule. <br/>
                La création du contrat entraînera une modification irrémédiable du kilométrage du véhicule.</p>
        </Group>
    )

    return (
        <Create
            title={<Title order={3}>Créer un contrat</Title>}
            footerButtons={
                <Group position="right" mt="xl">
                    {currentStep !== 0 && (
                        <Button variant="default" onClick={() => gotoStep(currentStep - 1)}>
                            Retour
                        </Button>
                    )}
                    {currentStep !== 3 && (
                        <Button onClick={() => gotoStep(currentStep + 1)}>Etape suivante</Button>
                    )}
                    {currentStep === 3 && <SaveButton {...saveButtonProps} />}
                </Group>
            }
            //wrapperProps={{style:{minHeight: "50vh"}, children:undefined}}
        >

            <Stepper active={currentStep} onStepClick={gotoStep} breakpoint="xs" styles={{content: {maxWidth: currentStep !== 3 ? 800 : undefined, margin:"auto"}}}>
                <Stepper.Step
                    label="Cibles"
                    description="Bénéficiaire et véhicule"
                    allowStepSelect={currentStep > 0}
                >
                    <BeneficiarySelect label="Bénéficiaire" value={beneficiaryValue} {...beneficiaryInputProps} error={errors.beneficiary} onChangeCompleteBeneficiary={setSelectedBeneficiary}/>

                    <VehicleSelect label="Véhicule" value={vehicleValue} {...vehicleInputProps} error={errors.vehicle} filters={[{field: "status", operator: "in", value: ["available"]}]} onChangeCompleteVehicle={setSelectedVehicle}/>

                    <NumberInput label="Kilométrage initial" {...getInputProps("start_kilometer")} error={errors.start_kilometer} disabled={selectedVehicle===undefined}/>

                    {warningMessage}

                </Stepper.Step>

                <Stepper.Step
                    label="Objet du contrat"
                    description="Informations générales"
                    allowStepSelect={currentStep > 1}
                >
                    <DateRangePicker locale="fr" label="Période du contrat" inputFormat="DD MMMM YYYY" labelFormat="DD-MM-YYYY" value={dateValue} onChange={handleDateChange} error={errors.start_date} placeholder="Début" />

                    <NumberInput label="Prix du contrat" {...getInputProps("price")} error={errors.price} />
                    <NumberInput label="Remise" {...getInputProps("discount")} error={errors.discount} />
                    <NumberInput label="Distance maximale" {...getInputProps("max_kilometer")} error={errors.max_kilometer} />

                    <Select label="Motif" {...getInputProps("reason")} error={errors.reason} data={reasonOptions} maxDropdownHeight={300} styles={{dropdown:{position:"fixed" }}}/>

                    <ReferentSelect label="Référent" value={referentValue} {...referentInputProps} error={errors.referent} onChangeCompleteReferent={setSelectedReferent}/>
                </Stepper.Step>

                <Stepper.Step
                    label="Caution"
                    description="Informations de caution"
                    allowStepSelect={currentStep > 2}
                >

                    <NumberInput label="Caution" {...getInputProps("deposit")} error={errors.deposit} />
                    <Select label="Mode de paiement" {...getInputProps("depositPaymentMode")} error={errors.depositPaymentMode} data={paymentModeOptions} withAsterisk/>
                    {values.depositPaymentMode === PaymentModeEnum.check && (
                        <NumberInput label="Numéro de chèque" {...getInputProps("deposit_check_number")} error={errors.deposit_check_number} />
                    )}

                </Stepper.Step>

                <Stepper.Step
                    label="Récapitulatif"
                    description="Résumé des informations"
                    allowStepSelect={currentStep > 3}
                >
                    <Stack>
                        <Group grow style={{alignItems:"stretch"}}>
                            <BeneficiaryCard title={<>Bénéficiaire</>} beneficiary={selectedBeneficiary} withName/>
                            <VehicleCard title={<>Véhicule</>} vehicle={selectedVehicle}/>
                        </Group>
                        <Paper shadow="sm" p="md" style={{maxWidth:900, margin:"auto"}}>
                            <Flex direction="column" align="center" gap="xs">
                                <Title style={{marginRight: "0.2em"}} order={2} >Contrat</Title>
                                <SimpleGrid cols={2} verticalSpacing={1}>
                                    <Text><span style={{fontWeight: "bold"}}>Début: </span> {humanizeDate(values.start_date)} </Text>
                                    <Text><span style={{fontWeight: "bold"}}>Référent: </span> { selectedReferent?.first_name && selectedReferent?.last_name ? humanizeFirstName(selectedReferent.first_name)+" "+selectedReferent.last_name.substring(1,0).toUpperCase()+"." : "--"} </Text>
                                    <Text><span style={{fontWeight: "bold"}}>Fin: </span> {humanizeDate(values.end_date)}</Text>
                                    <Text><span style={{fontWeight: "bold"}}>Prix: </span> {values.price}€</Text>
                                    <Text><span style={{fontWeight: "bold"}}>Temps du contrat: </span> { contractDuration(values)}j</Text>
                                    <Text><span style={{fontWeight: "bold"}}>Remise: </span> {values.discount}€</Text>

                                    <Text><span style={{fontWeight: "bold"}}>Caution: </span> {values.deposit}€</Text>

                                    <Text><span style={{fontWeight: "bold"}}>Km initial: </span> <span style={{color:startKilometerDirty ? "red" : undefined}}> {values.start_kilometer ? humanizeNumber(values.start_kilometer): "---"}km </span></Text>

                                    <Text><span style={{fontWeight: "bold"}}>Mode de paiement: </span> {values.depositPaymentMode ? paymentModeLabelMap[values.depositPaymentMode] : ""}</Text>
                                    <Text><span style={{fontWeight: "bold"}}>distance max: </span> {values.max_kilometer && humanizeNumber(values.max_kilometer)}km</Text>
                                    {values.depositPaymentMode === PaymentModeEnum.check && (
                                        <Text><span style={{fontWeight: "bold"}}>Numéro de chèque: </span> {values.deposit_check_number}</Text>
                                    )}
                                    {/*<Text><span style={{fontWeight: "bold"}}>Km max final: </span> {humanizeNumber(kmFinalMax)}km</Text>*/}

                                </SimpleGrid>
                            </Flex>
                        </Paper>
                        <Center>
                            {warningMessage}
                        </Center>
                    </Stack>
                </Stepper.Step>

            </Stepper>

        </Create>
    )
}

export default ContractCreate;
