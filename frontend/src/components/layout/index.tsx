import React from "react";
import { ThemedLayoutContextProvider } from "@refinedev/mantine";
import Header from "./header";
import {AppShell, Box, rem} from "@mantine/core";
import type { RefineThemedLayoutV2Props } from "@refinedev/mantine";
import NavBar from "./sider";
import {useThemedLayoutContext} from "@refinedev/mantine";
import {useHeadroom} from "@mantine/hooks";

export const Layout: React.FC<RefineThemedLayoutV2Props> = ({
                                                                Title,
                                                                initialSiderCollapsed,
                                                                children,
                                                            }) => {

    const { siderCollapsed, mobileSiderOpen, setMobileSiderOpen } =
        useThemedLayoutContext();

    const pinned = useHeadroom({fixedAt:120})

    const navBarWidth = siderCollapsed ? 80 : 200;

    const headerHeight = 52;

    return (
        <AppShell
            layout="alt"
            header={{height:52, collapsed: !pinned, offset: false}}
            navbar={{width:navBarWidth, breakpoint:"md", collapsed:{mobile:!mobileSiderOpen}}}
        >
            <Header />
            <NavBar Title={Title} />

            <AppShell.Main
                pt = {`calc(${rem(headerHeight)} + var(--mantine-spacing-md))`}
            style={{backgroundColor: "var(--mantine-color-scheme-dark)", height: "100vh"}}
            >
                {children}
            </AppShell.Main>

        </AppShell>
    );
};
