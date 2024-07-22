import {FallbackProps} from "react-error-boundary";
import {Center, Code, Flex, Text} from "@mantine/core";
import OpenBugReportButton from "./bugreporter/OpenBugReportButton";

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
    return (
        <Flex h={"100%"} direction="column" justify="center">


            <div>
                <Center>OhOh.</Center>
                <Center>Il semble qu'une erreur critique soit survenue.</Center>
                <Center>Essayez de recharger la page. Si l'erreur persiste, rapporter le bug !</Center>
                <Center style={{marginTop:20}}><OpenBugReportButton/></Center>

                <br/>

                <Text size="sm">Error:</Text>
                <Code>{error.message}</Code>
            </div>
        </Flex>
    );
}

export default ErrorFallback;
