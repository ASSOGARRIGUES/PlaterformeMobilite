import React, {useEffect} from "react";
import { ThemedLayoutContextProvider } from "@refinedev/mantine";
import Header from "./header";
import {AppShell, Box, px, rem, useMantineTheme} from "@mantine/core";
import type { RefineThemedLayoutV2Props } from "@refinedev/mantine";
import NavBar from "./sider";
import {useThemedLayoutContext} from "@refinedev/mantine";
import {useHeadroom, useWindowScroll} from "@mantine/hooks";
import {ErrorBoundary} from "react-error-boundary";
import ErrorFallback from "../ErrorFallback";

export const Layout: React.FC<RefineThemedLayoutV2Props> = ({
                                                                Title,
                                                                initialSiderCollapsed,
                                                                children,
                                                            }) => {

    const { siderCollapsed, mobileSiderOpen, setMobileSiderOpen } =
        useThemedLayoutContext();

    // const theme = useMantineTheme()
    //
    // const [scroll, scrollTo] = useWindowScroll();
    //
    // useEffect(() => {
    //     if(scroll.y===0) {
    //         setTimeout(() => {
    //             if(scroll.y===0) {
    //                 scrollTo({y:headerHeight+Number(px(theme.spacing.md))})
    //             }
    //         }, 5000);
    //     }
    //
    // }, [scroll]);

    const navBarWidth = siderCollapsed ? 80 : 200;

    const headerHeight = 52;

    const pinned = useHeadroom({fixedAt:headerHeight})

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
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                    <div style={{paddingRight: 8, paddingLeft: 8, height:"100%"}}>
                        {children}
                    </div>
                </ErrorBoundary>

            </AppShell.Main>

        </AppShell>
    );
};
