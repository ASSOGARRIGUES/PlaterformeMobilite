import {ActionIcon, Button, Tooltip} from "@mantine/core";
import {IconBug} from "@tabler/icons-react";
import React from "react";
import {useBugReporter} from "../../context/BugReporterProvider";

const OpenBugReportButton = () => {

    const {openBugModal} = useBugReporter();

    return (
        <>
            <Tooltip label={"Signaler un bug"} position="bottom"  >
                <Button visibleFrom="sm" onClick={openBugModal}  size="xs" mr={8}>
                    <IconBug style={{marginRight:"10px"}}/> Signaler un bug
                </Button>
            </Tooltip>

            <Tooltip label={"Signaler un bug"} position="bottom" >
                <ActionIcon hiddenFrom="sm" onClick={openBugModal} mr={8}>
                    <IconBug/>
                </ActionIcon>
            </Tooltip>
        </>
    )

}

export default OpenBugReportButton;
