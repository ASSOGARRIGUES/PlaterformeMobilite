import {User} from "../../../types/auth";
import {
    ActionIcon,
    Button,
    ColorInput, ColorSwatch,
    Group,
    Loader,
    MultiSelect,
    Paper,
    Stack,
    TextInput,
    Tooltip
} from "@mantine/core";
import {ComboboxData} from "@mantine/core/lib/components/Combobox/Combobox.types";
import {useEffect, useState} from "react";
import {IconEdit, IconTrash} from "@tabler/icons-react";
import {useForm} from "@mantine/form";

type ReferentGroup = {id:number, name: string, color:string, referents: User[]};

type ReferentGroupProps = {referentGroup: ReferentGroup, referentData:ComboboxData, isLoading?:boolean, onDelete?: (id:number)=>void, onChange?: (group:Omit<ReferentGroup, "referents"> & {referents: number[]})=>void};
const ReferentGroup = ({referentGroup, referentData, isLoading, onDelete, onChange}: ReferentGroupProps)=>{

    const [isEditing, setIsEditing] = useState(false);

    const validators = {
        name: (value: string) => value.length === 0 && "Le nom est obligatoire",
        color: (value: string) => value.length === 0 && "La couleur est obligatoire",
        referents: (value: string[]) => value.length === 0 && "Au moins un référent est obligatoire"
    }

    const form = useForm({
        initialValues: {
            color: referentGroup.color,
            name: referentGroup.name,
            referents: referentGroup.referents.map((referent) => referent?.id.toString())
        },
        validate: validators,
        validateInputOnBlur: true

    })

    useEffect(() => {
        form.setValues({
            color: referentGroup.color,
            name: referentGroup.name,
            referents: referentGroup.referents.map((referent) => referent?.id.toString())
        });
    }, [referentGroup.referents]);

    const handleSave = () => {

        form.onSubmit((values) => {
            setIsEditing(false);
            if(!onChange) return;

            //Call the onChange function with the new values
            onChange({
                id: referentGroup.id,
                ...values,
                referents: values.referents.map((id) => parseInt(id))
            });
        })();

    }

    return (
        <Paper shadow="sm" p="md" style={{maxWidth:"400px"}}>
            <Stack>
                <Group justify={"space-between"}>
                    <Group gap={8}>
                        {!isEditing && (
                            <>
                                <ColorSwatch color={referentGroup.color} size={20}/>
                                {/*<div style={{backgroundColor: referentGroup.color, width:"20px", height:"20px", borderRadius:"10px"}}></div>*/}
                                <div>{referentGroup.name}</div>
                            </>
                        )}
                    </Group>

                    {/*Actions buttons*/}
                    <Group gap={0}>
                        {!isEditing && (
                            <Tooltip label={"Editer le groupe"}>
                                <ActionIcon onClick={()=>setIsEditing(true)} color="blue" variant="subtle">
                                    <IconEdit size={20}/>
                                </ActionIcon>
                            </Tooltip>
                        )}
                        <Tooltip label={"Supprimer le groupe"}>
                            <ActionIcon onClick={()=>onDelete && onDelete(referentGroup.id)} color="red" variant="subtle">
                                <IconTrash size={20}/>
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {isEditing && (
                    <>
                        <ColorInput {...form.getInputProps("color")}/>
                        <TextInput {...form.getInputProps("name")}/>
                    </>
                )}

                <MultiSelect
                    data={referentData}
                    {...form.getInputProps("referents")}
                    placeholder={isEditing ? "Select referents" : undefined}

                    multiple
                    rightSection={isLoading ? <Loader size="xs" variant="bars"/>: undefined}
                    readOnly={!isEditing}
                />

                { isEditing && (
                    <Button onClick={handleSave}>
                        Enregistrer
                    </Button>
                )}
            </Stack>
        </Paper>
    )
}

export default ReferentGroup;