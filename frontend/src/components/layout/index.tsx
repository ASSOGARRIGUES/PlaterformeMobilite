import React from "react";
import { ThemedLayoutContextProvider } from "@refinedev/mantine";
import Header from "./header";
import {AppShell, Box} from "@mantine/core";
import type { RefineThemedLayoutV2Props } from "@refinedev/mantine";
import NavBar from "./sider";
import {useThemedLayoutContext} from "@refinedev/mantine";

export const Layout: React.FC<RefineThemedLayoutV2Props> = ({
                                                                Title,
                                                                initialSiderCollapsed,
                                                                children,
                                                            }) => {

    const { siderCollapsed, mobileSiderOpen, setMobileSiderOpen } =
        useThemedLayoutContext();

    const navBarWidth = siderCollapsed ? 80 : 200;
    console.log(mobileSiderOpen)

    return (
        <AppShell
            layout="alt"
            header={{height:52}}
            navbar={{width:navBarWidth, breakpoint:"md", collapsed:{mobile:!mobileSiderOpen}}}
        >
            <Header />
            <NavBar Title={Title} />

            <AppShell.Main>
                {children}
            </AppShell.Main>

        </AppShell>
    );
};
