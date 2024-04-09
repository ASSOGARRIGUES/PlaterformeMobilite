import {Dropzone, FileWithPath, IMAGE_MIME_TYPE} from "@mantine/dropzone";
import {Group, useMantineTheme, Text, Avatar, Image, Center, InputProps, FileInput} from "@mantine/core";
import {IconCameraFilled, IconUpload, IconX} from "@tabler/icons-react";
import carIcon from "../../assets/car.svg";
import {GetInputProps} from "@mantine/form/lib/types";

function IconPhoto(props: { size: number, stroke: number }) {
    return null;
}

const AvatarUpload = ({value, onChange, ...props}: {value:string | undefined, onChange: (p: string | undefined)=>{}}) => {
    const theme = useMantineTheme();


    function fileSelectedHandler(files: FileWithPath[]) {
        const file = files[0];
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            onChange(reader.result as string ?? undefined);
        }
    }

    return (
        <>
            <Dropzone
                onDrop={fileSelectedHandler}
                onReject={(files) => console.log('rejected files', files)}
                sx={(theme) => ({
                    border: 0,
                })}
                accept={IMAGE_MIME_TYPE}
                multiple={false}
            >

                <Center>
                    <Dropzone.Accept>
                        <IconUpload
                            size={200}
                            stroke={1.5}
                            color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
                        />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                        <IconX
                            size={200}
                            stroke={1.5}
                            color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]}
                        />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                        <div style={{position: "relative"}}>
                            <Avatar src={value} alt="it's me" size={200} radius={100} color={theme.colors.gray[1]}>
                                <Image src={carIcon} alt="Voiture"/>
                            </Avatar>
                            <div style={{position: "absolute", bottom: "0px", right:"0px", backgroundColor: theme.colors.gray[2], padding: "4px", borderRadius:"25px", height:"58px"}}>
                                <IconCameraFilled size="50px"/>
                            </div>
                        </div>

                    </Dropzone.Idle>
                </Center>
            </Dropzone>
        </>
    )
}

export default AvatarUpload;
