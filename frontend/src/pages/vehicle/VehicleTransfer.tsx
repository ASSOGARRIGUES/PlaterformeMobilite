import {useApiUrl, useCustomMutation, useParsed, useInvalidate, useShow, useGo} from "@refinedev/core";
import {Parking, Vehicle, VehicleActionTransfer} from "../../types/vehicle";
import {Edit} from "@refinedev/mantine";
import {Button, Flex, Group, Paper, Stepper, Title} from "@mantine/core";
import ActionSelect from "../../components/actions/ActionSelect";
import {FormErrors, useForm} from "@mantine/form";
import {SaveButton} from "../../components/SaveButton";
import React, {useState} from "react";
import ParkingSelect from "../../components/Vehicle/ParkingSelect";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import {Action} from "../../types/actions";
import {ErrorComponent} from "../../components/ErrorComponent";

type VehicleTransferFormFields = {action: Action | undefined, parking: Parking | undefined};
const VehicleTransfer = () => {

    const {id} = useParsed();

    const apiUrl = useApiUrl();
    const { mutate } = useCustomMutation<VehicleActionTransfer>();
    const invalidate = useInvalidate();
    const go = useGo();

    const { queryResult: showResponse } = useShow<Vehicle>({resource: "vehicle", id: id});

    const vehicle  = showResponse.data?.data;
    const [currentStep, setCurrentStep] = useState(0);

    const initialValues: VehicleTransferFormFields = {
        action: undefined,
        parking: undefined
    }

    const validate = (values:VehicleTransferFormFields): FormErrors => {

        if (currentStep === 0) {
            return {
                action: values.action ? (values.action.id != vehicle?.action.id ? undefined : "Le véhicule est déjà dans cette action") : "L'action cible est requise",
                parking: values.parking ? undefined : "Le parking cible est requis",
            }
        }

        return {};
    }

    /*
    ################
    #  MODAL FORM  #
    ################
    */

    const form = useForm({
        initialValues,
        validate,
        validateInputOnBlur: true,
    })

    const gotoStep = (step: number) => {
        if (step < 0 || step > 1) return;
        if (!form.isValid()) return;
        setCurrentStep(step);
    }

    const formSubmit = () => {
        console.log("Form submitted");
        form.onSubmit((values) => {
            if (!values.action || !values.parking) return;
            const transferValues = {action: values.action.id, parking: values.parking.id};
            mutate({
                url: `${apiUrl}/vehicle/${id}/action_transfer/`,
                method: "post",
                values: transferValues,
                successNotification: {
                    type: "success",
                    message: "Le véhicule a été transféré avec succès",
                }
            }, {
                onSuccess: () => {
                    invalidate({
                        resource: "vehicle",
                        invalidates: ["all"]
                    })

                    go({
                        to: "/vehicle",
                    })
                }
            })
        })();
    }

    // If the vehicle is not found, show an error
    if(showResponse.error?.statusCode === 404) return <ErrorComponent errorMessage={"Le vehicule n'existe pas ou n'est pas accessible"}/>;

    return (
        <Edit
            title={<Title order={3}>Transfert du véhicule vers une autre action</Title>}
            footerButtons={
                <Group gap="right" mt="xl">
                    {currentStep !== 0 && (
                        <Button variant="default" onClick={() => gotoStep(currentStep - 1)}>
                            Retour
                        </Button>
                    )}
                    {currentStep !== 1 && (
                        <Button onClick={() => gotoStep(currentStep + 1)}>Etape suivante</Button>
                    )}
                    {currentStep === 1 && <SaveButton onClick={formSubmit}/>}
                </Group>
            }
        >

            <Stepper active={currentStep} onStepClick={gotoStep}  styles={{content: {maxWidth: currentStep !== 2 ? 800 : undefined, margin:"auto"}}}>
                <Stepper.Step
                    label="Cibles"
                    description="Action et parking cible"
                    allowStepSelect={currentStep > 0}
                >
                    <ActionSelect withLabel={true} {...form.getInputProps('action')}/>

                    <ParkingSelect
                        withLabel={true}
                        {...form.getInputProps('parking')}
                        filters={[{field: "actions", operator: "eq", value: form.values.action?.id}]}
                    />


                </Stepper.Step>

                <Stepper.Step
                    label="Recapitulatif"
                    allowStepSelect={currentStep > 1}
                >

                    <Paper shadow="sm" p="md" style={{maxWidth:900, margin:"auto"}}>
                        <Flex direction="column" align="center" gap="xs">
                            <Title style={{marginRight: "0.2em"}} order={2} >Recapitulatif</Title>
                        </Flex>
                        <p>Transfert du véhicule <VehicleBadge vehicle={vehicle}/> vers l'action <b>{form.values.action?.name}</b> et le parking <b>{form.values.parking?.name}</b></p>

                    </Paper>

                </Stepper.Step>


            </Stepper>


        </Edit>
    )
}

export default VehicleTransfer