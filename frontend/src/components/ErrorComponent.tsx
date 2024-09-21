import React, { useEffect, useState } from "react";
import { RefineErrorPageProps } from "@refinedev/ui-types";
import {
    useNavigation,
    useTranslate,
    useGo,
    useResource,
    useRouterType,
} from "@refinedev/core";
import {
    Box,
    Title,
    Text,
    Group,
    Tooltip,
    ActionIcon,
    Button,
    Space, useMantineTheme, useMantineColorScheme, useMatches,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

export const ErrorComponent = ({errorMessage}: {errorMessage?:string}) => {
    const go = useGo();

    const theme = useMantineTheme()
    const {colorScheme} = useMantineColorScheme()

    const fontSize = useMatches({
        base: 120,
        sm: 220,
    })

    return (
        <Box
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                boxSizing: "border-box",
                minHeight: "calc(100vh - 150px)",
            }}
        >
            <Title
                style={{
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: fontSize,
                    lineHeight: 1,
                    color:
                        colorScheme === "dark"
                            ? theme.colors.dark[4]
                            : theme.colors.gray[2],
                }}
            >
                404
            </Title>
            <Group gap={4} align="center" style={{ justifyContent: "center" }}>
                <Text c="dimmed" size="lg" ta="center" style={{ maxWidth: 500 }}>
                    {errorMessage ? errorMessage : "La page que vous recherchez n'existe pas"}
                </Text>
            </Group>
            <Space h="md" />
            <Button
                variant="subtle"
                size="md"
                onClick={() => {
                    go({ to: "/" });
                }}
            >
                Retour à l'accueil
            </Button>
        </Box>
    );
};
