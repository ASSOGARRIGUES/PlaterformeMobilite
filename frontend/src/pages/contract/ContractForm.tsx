import {Contract, ContractWritableFields, EndContractWritableFields} from "../../types/contract";
import {BlankEnum, PaymentModeEnum, ReasonEnum} from "../../types/schema.d";
import {FormErrors, useForm} from "@mantine/form";
import {
    Alert,
    Button,
    Center,
    Flex,
    Group,
    NumberInput,
    Paper,
    Select,
    SimpleGrid,
    Stack,
    Stepper,
    Text,
    TextInput,
    Title,
    Tooltip,
} from "@mantine/core";
import {SaveButton} from "../../components/SaveButton";
import React, {useEffect, useRef, useState} from "react";
import {
    useApiUrl,
    useCustomMutation,
    useGo,
    useInvalidate,
    useParsed,
    useShow,
} from "@refinedev/core";
import {useStepsForm} from "@refinedev/mantine";
import {
    contractReasonLabelMap,
    humanizeDate,
    humanizeFirstName,
    humanizeNumber,
    paymentModeLabelMap,
} from "../../constants";
import dayjs from "dayjs";
import BeneficiarySelect from "../../components/beneficiary/BeneficiarySelect";
import VehicleSelect from "../../components/Vehicle/VehicleSelect";
import ReferentSelect from "../../components/user/UserSelect";
import {Beneficiary} from "../../types/beneficiary";
import {Vehicle} from "../../types/vehicle";
import {User} from "../../types/auth";
import BeneficiaryCard from "../../components/beneficiary/BeneficiaryCard";
import VehicleCard from "../../components/Vehicle/VehicleCard";
import {IconAlertTriangle, IconInfoCircle} from "@tabler/icons-react";
import {DatePickerInput} from "@mantine/dates";
import {DatesRangeValue} from "@mantine/dates/lib/types/DatePickerValue";
import {Create} from "@refinedev/mantine";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import {notifications} from "@mantine/notifications";

// ---------------------------------------------------------------------------
// ContractForm — handles both creation and renewal in a single component.
// In renewal mode (id param present), vehicle and beneficiary are locked to
// the source contract and the form submits to POST /api/contract/{id}/renew/.
// ---------------------------------------------------------------------------

const ContractForm = () => {
    const {id} = useParsed();
    const isRenew = id !== undefined;

    const apiUrl = useApiUrl();
    const {mutate: renewMutate, isLoading: isRenewSaving} = useCustomMutation<Contract>();
    const {mutate: endMutate} = useCustomMutation();
    const invalidate = useInvalidate();
    const go = useGo();

    // Load source contract only in renew mode
    const {queryResult: sourceResult} = useShow<Contract>({
        resource: "contract",
        id,
        queryOptions: {enabled: isRenew},
    });
    const sourceContract = isRenew ? (sourceResult.data?.data as Contract | undefined) : undefined;

    const sourceVehicle = sourceContract?.vehicle;
    const sourceBeneficiary = sourceContract?.beneficiary;

    const effectiveCloseDate: Date = sourceContract
        ? dayjs(sourceContract.end_date).isAfter(dayjs(), "day")
            ? dayjs(sourceContract.end_date).toDate()
            : dayjs().toDate()
        : new Date();

    const isPastDue =
        isRenew && sourceContract
            ? dayjs().isAfter(dayjs(sourceContract.end_date), "day")
            : false;

    // -------------------------------------------------------------------------
    // End-contract form (renew mode only)
    // -------------------------------------------------------------------------
    const endForm = useForm<EndContractWritableFields>({
        initialValues: {end_kilometer: 0, price: 0, deposit: 315, discount: 0},
        validateInputOnBlur: true,
        validate: {
            end_kilometer: (value) => {
                if (value === undefined) return "Le kilométrage de fin est obligatoire";
                if (value < 0) return "Le kilométrage de fin ne peut pas être négatif";
                if (sourceContract?.start_kilometer && value < sourceContract.start_kilometer)
                    return `Le kilométrage de fin ne peut pas être inférieur au kilométrage de début (${sourceContract.start_kilometer} km)`;
            },
            price: (value) => value === undefined || value < 0 ? "Le prix est requis et ne peut pas être négatif" : undefined,
            deposit: (value) => value === undefined || value < 0 ? "La caution est requise et ne peut pas être négative" : undefined,
            discount: (value) => value !== undefined && value < 0 ? "La remise ne peut pas être négative" : undefined,
        },
    });

    // -------------------------------------------------------------------------
    // Local state for objects selected via custom select components
    // -------------------------------------------------------------------------
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | undefined>(
        undefined
    );
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>(undefined);
    const [selectedReferent, setSelectedReferent] = useState<User | undefined>(undefined);
    const [startKilometerDirty, setStartKilometerDirty] = useState(false);
    const currentStepRef = useRef(0);

    // -------------------------------------------------------------------------
    // Form
    // -------------------------------------------------------------------------
    const initialValues: ContractWritableFields = {
        vehicle: isRenew ? (sourceVehicle?.id ?? 0) : 0,
        beneficiary: isRenew ? (sourceBeneficiary?.id ?? 0) : 0,
        deposit: 315,
        depositPaymentMode: undefined,
        deposit_check_number: undefined,
        start_kilometer: isRenew ? (sourceVehicle?.kilometer ?? 0) : 0,
        price: 100,
        start_date: isRenew ? dayjs(effectiveCloseDate).format("YYYY-MM-DD") : new Date().toISOString(),
        end_date: isRenew ? dayjs(effectiveCloseDate).format("YYYY-MM-DD") : new Date().toISOString(),
        referent: 0,
        max_kilometer: 0,
        reason: BlankEnum[""],
        discount: 0,
    };

    const LAST_STEP = 3;

    const validate = (values: ContractWritableFields, step: number): FormErrors => {
        const objectStep = 1;
        const depositStep = 2;

        if (!isRenew && step === 0) {
            return {
                vehicle: values.vehicle ? undefined : "Le véhicule est requis",
                beneficiary: values.beneficiary ? undefined : "Le bénéficiaire est requis",
            };
        }

        // In renew mode, step 0 = closure — validated by endForm directly
        if (isRenew && step === 0) return {};

        if (step === objectStep) {
            const minDate = isRenew ? effectiveCloseDate : undefined;
            const startDateError = !values.start_date || !values.end_date
                ? "La date de début est requise"
                : values.start_date >= values.end_date
                    ? "La date de fin doit être supérieure à la date de début"
                    : minDate && dayjs(values.start_date).isBefore(dayjs(minDate), "day")
                        ? `La date de début doit être au minimum le ${dayjs(minDate).format("DD/MM/YYYY")}`
                        : undefined;

            return {
                price: values.price ? undefined : "Le prix est requis",
                discount: values.discount !== undefined && values.discount < 0
                    ? "La remise ne peut pas être négative"
                    : undefined,
                start_date: startDateError,
                referent: values.referent ? undefined : "Le référent est requis",
                max_kilometer: values.max_kilometer
                    ? values.max_kilometer < 0 ? "Le kilométrage maximum ne peut pas être négatif" : undefined
                    : "Le kilométrage maximum est requis",
                reason: values.reason ? undefined : "La raison est requise",
            };
        }

        if (step === depositStep) {
            if (isRenew) return {};
            return {
                deposit: values.deposit
                    ? values.deposit < 0 ? "La caution ne peut pas être négative" : undefined
                    : "La caution est requise",
                depositPaymentMode: values.depositPaymentMode
                    ? undefined
                    : "Le mode de paiement de la caution est requis",
                deposit_check_number:
                    values.depositPaymentMode === PaymentModeEnum.check && !values.deposit_check_number
                        ? "Le numéro de chèque est requis"
                        : undefined,
            };
        }

        return {};
    };

    const {
        saveButtonProps,
        getInputProps,
        values,
        errors,
        steps: {currentStep, gotoStep},
        setValues,
    } = useStepsForm({
        initialValues,
        validate: (values) => validate(values as ContractWritableFields, currentStepRef.current),
        validateInputOnBlur: true,
        refineCoreProps: {action: "create", redirect: "show"},
        transformValues: (values) => ({
            ...values,
            start_kilometer: startKilometerDirty ? values.start_kilometer : undefined,
        }),
    });

    useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

    // Resync form when source contract loads in renew mode
    useEffect(() => {
        if (!sourceContract) return;
        endForm.setValues({
            end_kilometer: sourceContract.vehicle?.kilometer ?? 0,
            price: sourceContract.price ?? 0,
            deposit: sourceContract.deposit ?? 315,
            discount: sourceContract.discount ?? 0,
        });
        const closeDate = dayjs(sourceContract.end_date).isAfter(dayjs(), "day")
            ? sourceContract.end_date
            : dayjs().format("YYYY-MM-DD");
        setValues({
            vehicle: sourceContract.vehicle.id,
            beneficiary: sourceContract.beneficiary.id,
            start_kilometer: sourceContract.vehicle.kilometer,
            start_date: closeDate,
            end_date: closeDate,
            referent: sourceContract.referent?.id ?? 0,
            reason: sourceContract.reason ?? BlankEnum[""],
        });
        setSelectedReferent(sourceContract.referent as unknown as User);
        setSelectedVehicle(sourceContract.vehicle as unknown as Vehicle);
        setSelectedBeneficiary(sourceContract.beneficiary as unknown as Beneficiary);
        const closeDateObj = dayjs(closeDate).toDate();
        setDateValue([closeDateObj, closeDateObj]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceContract?.id]);

    useEffect(() => {
        if (!isRenew) getInputProps("start_kilometer").onChange(selectedVehicle?.kilometer ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVehicle]);

    useEffect(() => {
        if (isRenew) getInputProps("start_kilometer").onChange(endForm.values.end_kilometer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endForm.values.end_kilometer]);

    useEffect(() => {
        const vehicle = isRenew ? sourceVehicle : selectedVehicle;
        setStartKilometerDirty(vehicle !== undefined && values.start_kilometer !== vehicle.kilometer);
    }, [selectedVehicle, sourceVehicle, values.start_kilometer]);

    // -------------------------------------------------------------------------
    // Date range picker
    // -------------------------------------------------------------------------
    const startDateInputProps = getInputProps("start_date");
    const endDateInputProps = getInputProps("end_date");

    const [dateValue, setDateValue] = React.useState<DatesRangeValue>([
        new Date(startDateInputProps.value || effectiveCloseDate),
        new Date(endDateInputProps.value || effectiveCloseDate),
    ]);

    function handleDateChange(value: DatesRangeValue) {
        setDateValue(value);
        startDateInputProps.onChange(value[0] ? dayjs(value[0]).format("YYYY-MM-DD") : null);
        endDateInputProps.onChange(value[1] ? dayjs(value[1]).format("YYYY-MM-DD") : null);
    }

    // -------------------------------------------------------------------------
    // Field value extraction
    // -------------------------------------------------------------------------
    const {value: beneficiaryObj, ...beneficiaryInputProps} = getInputProps("beneficiary");
    const {value: vehicleObj, ...vehicleInputProps} = getInputProps("vehicle");
    const {value: referentObj, ...referentInputProps} = getInputProps("referent");

    const beneficiaryValue = beneficiaryObj?.id || beneficiaryObj;
    const vehicleValue = vehicleObj?.id || vehicleObj;
    const referentValue = referentObj?.id || referentObj;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    const reasonOptions = Object.values(ReasonEnum).map((r) => ({
        value: r,
        label: contractReasonLabelMap[r],
    }));
    const paymentModeOptions = Object.values(PaymentModeEnum).map((m) => ({
        value: m,
        label: paymentModeLabelMap[m],
    }));

    const contractDuration = () => {
        const end = new Date(values.end_date);
        const start = new Date(values.start_date);
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    };

    const warningMessage = (
        <Group style={{display: startKilometerDirty ? "flex" : "none"}} align="center">
            <IconAlertTriangle size={35} color="red"/>
            <p style={{color: "red", flex: "auto"}}>
                Le kilométrage initial entré est différent du kilométrage actuellement connu du véhicule.
                <br/>
                La création du contrat entraînera une modification irrémédiable du kilométrage du véhicule.
            </p>
        </Group>
    );

    // -------------------------------------------------------------------------
    // Renew submit (create uses saveButtonProps from useStepsForm)
    // -------------------------------------------------------------------------
    const handleRenewSave = () => {
        if (endForm.validate().hasErrors) return;
        renewMutate(
            {
                url: `${apiUrl}/contract/${id}/renew/`,
                method: "post",
                values: {
                    ...values,
                    start_kilometer: startKilometerDirty ? values.start_kilometer : undefined,
                },
            },
            {
                onSuccess: (data) => {
                    const newContractId = data.data.id;
                    endMutate(
                        {
                            url: `${apiUrl}/contract/${id}/end/`,
                            method: "patch",
                            values: endForm.values,
                        },
                        {
                            onSuccess: () => {
                                invalidate({resource: "contract", invalidates: ["list", "detail"]});
                                go({to: `/contract/${newContractId}`});
                            },
                            onError: () => {
                                notifications.show({
                                    color: "orange",
                                    title: "Clôture échouée",
                                    message: `Le renouvellement #${newContractId} a été créé mais la clôture du contrat source a échoué. Vous pouvez la faire manuellement.`,
                                    autoClose: false,
                                });
                                invalidate({resource: "contract", invalidates: ["list", "detail"]});
                                go({to: `/contract/${newContractId}`});
                            },
                        }
                    );
                },
            }
        );
    };

    // -------------------------------------------------------------------------
    // Shared step content
    // -------------------------------------------------------------------------
    const stepClosure = isRenew && (
        <Stack gap="sm" mt="md">
            <Group grow style={{alignItems: "stretch"}}>
                <BeneficiaryCard
                    title={<BeneficiaryBadge beneficiary={sourceBeneficiary}/>}
                    beneficiary={sourceBeneficiary}
                    withName
                />
                <VehicleCard title={<>Véhicule</>} vehicle={sourceVehicle} withEdit={false}/>
            </Group>
            <NumberInput
                label="Kilométrage final"
                {...endForm.getInputProps("end_kilometer")}
            />
            <NumberInput label="Prix du contrat" {...endForm.getInputProps("price")}/>
            <NumberInput label="Caution" {...endForm.getInputProps("deposit")}/>
            <NumberInput label="Remise" {...endForm.getInputProps("discount")}/>
        </Stack>
    );

    const stepObject = (
        <Stack gap="sm" mt="md">
            {isRenew && (
                <Group grow style={{alignItems: "stretch"}}>
                    <BeneficiaryCard
                        title={<BeneficiaryBadge beneficiary={sourceBeneficiary}/>}
                        beneficiary={sourceBeneficiary}
                        withName
                    />
                    <VehicleCard title={<>Véhicule</>} vehicle={sourceVehicle} withEdit={false}/>
                </Group>
            )}

            <Tooltip
                label="Pré-rempli depuis le kilométrage final saisi à l'étape précédente."
                disabled={!isRenew}
            >
                <NumberInput
                    label="Kilométrage initial"
                    {...getInputProps("start_kilometer")}
                    error={errors.start_kilometer}
                    readOnly={isRenew}
                />
            </Tooltip>
            {warningMessage}

            <DatePickerInput
                type="range"
                locale="fr"
                label="Période du contrat"
                valueFormat="DD/MM/YYYY"
                value={dateValue}
                onChange={handleDateChange}
                error={errors.start_date}
                minDate={isRenew ? effectiveCloseDate : undefined}
                placeholder="Début"
            />
            <NumberInput label="Prix du contrat" {...getInputProps("price")} error={errors.price}/>
            <NumberInput label="Remise" {...getInputProps("discount")} error={errors.discount}/>
            <NumberInput label="Distance maximale" {...getInputProps("max_kilometer")} error={errors.max_kilometer}/>
            <Select
                label="Motif"
                {...getInputProps("reason")}
                error={errors.reason}
                data={reasonOptions}
                maxDropdownHeight={300}
                styles={{dropdown: {position: "fixed"}}}
            />
            <ReferentSelect
                label="Référent"
                value={referentValue}
                {...referentInputProps}
                error={errors.referent}
                onChangeCompleteReferent={setSelectedReferent}
            />
        </Stack>
    );

    const rootDepositMode = sourceContract?.root_contract_deposit_payment_mode
        ? paymentModeLabelMap[sourceContract.root_contract_deposit_payment_mode as PaymentModeEnum] ?? sourceContract.root_contract_deposit_payment_mode
        : "—";

    const stepDeposit = isRenew ? (
        <Alert icon={<IconInfoCircle/>} color="blue" mt="md">
            <Text>
                Aucune caution n'est à percevoir pour ce renouvellement. La caution a été prise lors de la création du
                contrat <strong>#{sourceContract?.root_contract_id}</strong> le{" "}
                <strong>{sourceContract?.root_contract_created_at ? humanizeDate(sourceContract.root_contract_created_at) : "—"}</strong>.
            </Text>
            <Text mt="xs">
                <span style={{fontWeight: "bold"}}>Montant&nbsp;:</span> {sourceContract?.root_contract_deposit ?? "—"}€
                &nbsp;·&nbsp;
                <span style={{fontWeight: "bold"}}>Mode de paiement&nbsp;:</span> {rootDepositMode}
                {sourceContract?.root_contract_deposit_check_number && (
                    <>&nbsp;·&nbsp;<span style={{fontWeight: "bold"}}>N° chèque&nbsp;:</span> {sourceContract.root_contract_deposit_check_number}</>
                )}
            </Text>
        </Alert>
    ) : (
        <>
            <NumberInput label="Caution" {...getInputProps("deposit")} error={errors.deposit}/>
            <Select
                label="Mode de paiement"
                {...getInputProps("depositPaymentMode")}
                error={errors.depositPaymentMode}
                data={paymentModeOptions}
                withAsterisk
            />
            {values.depositPaymentMode === PaymentModeEnum.check && (
                <TextInput
                    label="Numéro de chèque"
                    {...getInputProps("deposit_check_number")}
                    error={errors.deposit_check_number}
                />
            )}
        </>
    );

    const displayedBeneficiary = isRenew ? sourceBeneficiary : selectedBeneficiary;
    const displayedVehicle = isRenew ? sourceVehicle : selectedVehicle;

    const stepSummary = (
        <Stack>
            <Group grow style={{alignItems: "stretch"}}>
                <BeneficiaryCard title={<>Bénéficiaire</>} beneficiary={displayedBeneficiary} withName/>
                <VehicleCard title={<>Véhicule</>} vehicle={displayedVehicle} withEdit={false}/>
            </Group>
            <Paper shadow="sm" p="md" style={{maxWidth: 900, margin: "auto"}}>
                <Flex direction="column" align="center" gap="xs">
                    <Title style={{marginRight: "0.2em"}} order={2}>Contrat</Title>
                    <SimpleGrid cols={2} verticalSpacing={1}>
                        <Text><span style={{fontWeight: "bold"}}>Début: </span>{humanizeDate(values.start_date)}</Text>
                        <Text>
                            <span style={{fontWeight: "bold"}}>Référent: </span>
                            {selectedReferent?.first_name && selectedReferent?.last_name
                                ? humanizeFirstName(selectedReferent.first_name) +
                                " " +
                                selectedReferent.last_name.substring(1, 0).toUpperCase() +
                                "."
                                : "--"}
                        </Text>
                        <Text><span style={{fontWeight: "bold"}}>Fin: </span>{humanizeDate(values.end_date)}</Text>
                        <Text><span style={{fontWeight: "bold"}}>Prix: </span>{values.price}€</Text>
                        <Text><span style={{fontWeight: "bold"}}>Temps du contrat: </span>{contractDuration()}j</Text>
                        <Text><span style={{fontWeight: "bold"}}>Remise: </span>{values.discount}€</Text>
                        {isRenew ? (
                            <Text style={{gridColumn: "span 2"}}>
                                <span style={{fontWeight: "bold"}}>Caution: </span>
                                {sourceContract?.root_contract_deposit ?? "—"}€ · {rootDepositMode}
                                {sourceContract?.root_contract_deposit_check_number && ` · N° ${sourceContract.root_contract_deposit_check_number}`}
                                {" · prise le "}{sourceContract?.root_contract_created_at ? humanizeDate(sourceContract.root_contract_created_at) : "—"}
                                {" (contrat #"}{sourceContract?.root_contract_id}{")"}
                            </Text>
                        ) : (
                            <>
                                <Text><span style={{fontWeight: "bold"}}>Caution: </span>{values.deposit}€</Text>
                                <Text>
                                    <span style={{fontWeight: "bold"}}>Mode de paiement: </span>
                                    {values.depositPaymentMode ? paymentModeLabelMap[values.depositPaymentMode] : ""}
                                </Text>
                            </>
                        )}
                        <Text>
                            <span style={{fontWeight: "bold"}}>Km initial: </span>
                            <span style={{color: startKilometerDirty ? "red" : undefined}}>
                                {values.start_kilometer ? humanizeNumber(values.start_kilometer) : "---"}km
                            </span>
                        </Text>
                        <Text>
                            <span style={{fontWeight: "bold"}}>Distance max: </span>
                            {values.max_kilometer && humanizeNumber(values.max_kilometer)}km
                        </Text>
                        {values.depositPaymentMode === PaymentModeEnum.check && (
                            <Text>
                                <span style={{fontWeight: "bold"}}>Numéro de chèque: </span>
                                {values.deposit_check_number}
                            </Text>
                        )}
                    </SimpleGrid>
                </Flex>
            </Paper>
            <Center>{warningMessage}</Center>
        </Stack>
    );

    // -------------------------------------------------------------------------
    // Footer buttons
    // -------------------------------------------------------------------------
    const footerButtons = (
        <Group gap="right" mt="xl">
            {currentStep !== 0 && (
                <Button variant="default" onClick={() => gotoStep(currentStep - 1)}>
                    Retour
                </Button>
            )}
            {currentStep !== LAST_STEP && (
                <Button onClick={() => {
                    if (isRenew && currentStep === 0 && endForm.validate().hasErrors) return;
                    gotoStep(currentStep + 1);
                }}>Étape suivante</Button>
            )}
            {currentStep === LAST_STEP && (
                isRenew
                    ? <SaveButton onClick={handleRenewSave} loading={isRenewSaving}/>
                    : <SaveButton {...saveButtonProps}/>
            )}
        </Group>
    );

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    const step0Create = (
        <>
            <BeneficiarySelect
                label="Bénéficiaire"
                value={beneficiaryValue}
                {...beneficiaryInputProps}
                error={errors.beneficiary}
                onChangeCompleteBeneficiary={setSelectedBeneficiary}
            />
            <VehicleSelect
                label="Véhicule"
                value={vehicleValue}
                {...vehicleInputProps}
                error={errors.vehicle}
                filters={[{field: "status", operator: "in", value: ["available"]}]}
                onChangeCompleteVehicle={setSelectedVehicle}
            />
            <NumberInput
                label="Kilométrage initial"
                {...getInputProps("start_kilometer")}
                error={errors.start_kilometer}
                disabled={selectedVehicle === undefined}
            />
            {warningMessage}
        </>
    );

    const stepperContent = (
        <Stepper
            active={currentStep}
            onStepClick={gotoStep}
            styles={{content: {maxWidth: currentStep !== LAST_STEP ? 800 : undefined, margin: "auto"}}}
        >
            {isRenew ? (
                <Stepper.Step label="Clôture" description="Informations de clôture" allowStepSelect={currentStep > 0}>
                    {stepClosure}
                </Stepper.Step>
            ) : (
                <Stepper.Step label="Cibles" description="Bénéficiaire et véhicule" allowStepSelect={currentStep > 0}>
                    {step0Create}
                </Stepper.Step>
            )}
            <Stepper.Step label="Objet du contrat" description={isRenew ? "Dates et informations" : "Informations générales"} allowStepSelect={currentStep > 1}>
                {stepObject}
            </Stepper.Step>
            <Stepper.Step label="Caution" description="Informations de caution" allowStepSelect={currentStep > 2}>
                {stepDeposit}
            </Stepper.Step>
            <Stepper.Step label="Récapitulatif" description={isRenew ? "Résumé" : "Résumé des informations"} allowStepSelect={currentStep > 3}>
                {stepSummary}
            </Stepper.Step>
        </Stepper>
    );

    const title = isRenew
        ? <Title order={3}>Renouveler le contrat #{id}</Title>
        : <Title order={3}>Créer un contrat</Title>;

    if (isRenew) {
        return (
            <Create title={title} resource="contract" footerButtons={footerButtons}>
                {isPastDue && (
                    <Alert icon={<IconInfoCircle/>} color="orange" mb="md">
                        Le contrat est arrivé à échéance le{" "}
                        <strong>{sourceContract?.end_date ? humanizeDate(sourceContract.end_date) : ""}</strong>.
                        La date de début du renouvellement sera au minimum aujourd'hui.
                    </Alert>
                )}
                {stepperContent}
            </Create>
        );
    }

    return (
        <Create title={title} footerButtons={footerButtons}>
            {stepperContent}
        </Create>
    );
};

export default ContractForm;
