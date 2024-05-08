import {Button, Loader, Stack, Textarea} from "@mantine/core";
import {CompleteContract, Contract} from "../../types/contract";
import {CSSProperties, useEffect, useState} from "react";
import {useUpdate} from "@refinedev/core";
import {useDebouncedValue} from "@mantine/hooks";

const ContractComment= ({contract, style}: {contract: Contract | CompleteContract | undefined, style?:CSSProperties}) => {

    const [comment, setComment] = useState<string>(contract?.comment || "");
    const [debouncedComment] = useDebouncedValue(comment, 1500);

    const { mutate , isLoading} = useUpdate();

    useEffect(() => {
        saveComment()
    }, [debouncedComment]);

    function saveComment() {
        if(!contract) return;
        if(comment === contract.comment) return;
        mutate({
            successNotification: false,
            resource: "contract",
            id: contract.id,
            values:{
                comment: comment
            }
        })
    }

    return (
        <Stack style={style}>
            <Textarea
                style={{flex:"auto"}}
                placeholder="Commentaire d'équipe"
                styles={{wrapper:{height:"100%"}, input:{height:"100%"}}}
                value={comment}
                onChange={(e)=>setComment(e.currentTarget.value)}
                disabled={!contract}
            />

            <Button onClick={saveComment} disabled={!contract}>
                {isLoading ? <Loader size="xs" color="black" />
                    : "Enregistrer"
                }
            </Button>
        </Stack>

    );
}

export default ContractComment;
