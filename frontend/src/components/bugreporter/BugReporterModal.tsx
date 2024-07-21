import {Button, Group, Modal, Radio, RadioGroup, Select, Textarea} from "@mantine/core";
import {useForm as useMantineForm} from "@mantine/form";
import {useForm as useRefineForm} from "@refinedev/core";
import {bugSeverityLabelMap, bugTypeLabelMap, vehicleTypeLabelMap, VERSION} from "../../constants";
import {FormEventHandler} from "react";
import logSaver from "../../logSaver";
import {BugWritableFields} from "../../types/bugtracker";
import {FormValidateInput} from "@mantine/form/lib/types";
import {BugSeverityEnum, BugTypeEnum, VehicleTypeEnum} from "../../types/schema.d";

const BugReporterModal = ({isBugModalOpen, setBugModalOpen}:{isBugModalOpen: boolean, setBugModalOpen:(open:boolean) => void}) => {

    /*
        #######################################
        ######## HTML Form Management #########
        #######################################
     */
    const initialValues: BugWritableFields = {
        type: BugTypeEnum.bug,
        description:"",
        reproduction_steps:"",
        targeted_version:"",
        logfile:undefined,
        severity:undefined,
    }

    const validate: FormValidateInput<BugWritableFields> = ({
        description: (value) => {
            if(value.length===0) {
                return "Vous devez entrer une description du bug";
            }
        },

        reproduction_steps: (value,values) => {
            if(values.type !== BugTypeEnum.bug) return; // Reproduction steps are not required for feature requests

            if(!value || value.length===0) {
                return "Vous devez décrire les étapes de reproduction du bug";
            }
        },

        type: (value) => {
            if(!value) {
                return "Vous devez choisir un type de demande";
            }else if(!Object.values(BugTypeEnum).includes(value)){
                return "Type de demande invalide"
            }
        },

        severity: (value, values) => {
            if(!value) {
                return "Vous devez choisir une sévérité";
            }else if(!Object.values(BugSeverityEnum).includes(value)){
                return "Sévérité invalide"
            }
        }
    });


    const form = useMantineForm({
        initialValues,
        validate: validate,
        validateInputOnBlur: true,
    });

    /*
        #########################
        ######## API FORM #######
        #########################
    */
    const {onFinish} = useRefineForm<BugWritableFields>({
        resource: "bugtracker/bug",
        action: "create",
        redirect: false,
        onMutationSuccess: () => {
            setBugModalOpen(false);
            form.reset();
        }
    });


    /**
     * @description Function to handle the form submission This function is called when the user clicks on the "Enregistrer" button,
     *                  it will retrieve the version of the app, the logs if there are any and submit the form to the API
     */
    const formSubmit: FormEventHandler = async (e) => {
        e.preventDefault()
        form.setFieldValue('targeted_version', VERSION)

        // If the user is reporting a bug and there are logs saved, attach the logs to the form
        if(form.getValues().type === "bug" && logSaver.hasLogs()) {
            // Wrap the FileReader into a promise to await the result
            const logInBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(logSaver.getLogsAsFile());
                reader.onload = () => {
                    resolve(reader.result as string);
                }
            });

            form.setFieldValue('logfile', logInBase64);
        }

        form.onSubmit(values => onFinish(values))();
    }

    const descriptionPlaceHolder = form.getValues().type === "bug" ? "Décrivez le bug que vous avez rencontré. Soyez le plus précis possible.  Et donnez des informations sur le contexte dans lequel vous avez rencontré le bug (n°de contrat, nom du beneficiaire, ect.)"
        : "Décrivez la fonctionnalité que vous aimeriez voir ajoutée ou la suggestion que vous avez à faire"

    const typeData = Object.keys(BugTypeEnum).map((key) =>  ({value: key, label: bugTypeLabelMap[key]}));

    return (
        <Modal opened={isBugModalOpen} onClose={()=>setBugModalOpen(false)} size="55rem" title={"Reporter un Bug"}>

            <form onSubmit={formSubmit}>
                <Select label="Type de la demande" required {...form.getInputProps('type')} data={typeData}/>

                <Textarea
                    placeholder={descriptionPlaceHolder}
                    label={"Description" + (form.getValues().type === "bug" ? " du bug" : " de la fonctionnalité")}
                    required
                    rows={5}
                    style={{marginBottom: "1rem"}}
                    {...form.getInputProps('description')}
                />

                {form.getValues().type === "bug" && (
                    <Textarea
                        placeholder="Décrivez les étapes pour reproduire le bug"
                        label="Étapes pour reproduire le bug"
                        required
                        rows={5}
                        style={{marginBottom: "1rem"}}
                        {...form.getInputProps('reproduction_steps')}
                    />
                )}

                <RadioGroup
                    label={"Sévérité"}
                    required
                    style={{marginBottom: "1rem"}}
                    {...form.getInputProps('severity')}
                >
                    <Group gap="md">
                        {Object.keys(BugSeverityEnum).map((key) => (
                            <Radio key={key} value={key} label={bugSeverityLabelMap[key]} />
                        ))}
                    </Group>
                </RadioGroup>

                <Button type="submit" style={{marginTop: 20,width:"100%"}}>Enregistrer</Button>
            </form>


        </Modal>
    );
}

export default BugReporterModal;
