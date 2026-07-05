import React, {useEffect} from "react";
import { ThemedLayoutContextProvider } from "@refinedev/mantine";
import Header from "./header";
import {AppShell, Box, px, rem, useMantineTheme} from "@mantine/core";
import type { RefineThemedLayoutV2Props } from "@refinedev/mantine";
import NavBar from "./sider";
import {useThemedLayoutContext} from "@refinedev/mantine";
import {useHeadroom, useMediaQuery, useWindowScroll} from "@mantine/hooks";
import {ErrorBoundary} from "react-error-boundary";
import ErrorFallback from "../ErrorFallback";
import {OfflineBanner} from "../garage/OfflineBanner";
import {GarageBottomNav} from "../garage/GarageBottomNav";

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

    const theme = useMantineTheme()
    const navBarWidth = siderCollapsed ? 80 : 200;

    const headerHeight = 52;
    const bottomNavHeight = 'calc(64px + env(safe-area-inset-bottom))';

    const pinned = useHeadroom({fixedAt:headerHeight})
    const isMobile = useMediaQuery('(max-width: 768px)')
    const isStandalone = useMediaQuery('(display-mode: standalone)')

    const isPWAMobile = isMobile && isStandalone

    return (
        <>
            <OfflineBanner />
            {isPWAMobile && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 'env(safe-area-inset-top)',
                    backgroundColor: theme.colors.cyan[8],
                    zIndex: 1000,
                }} />
            )}
            <AppShell
                layout="alt"
                header={{height:52, collapsed: !pinned || isPWAMobile, offset: false}}
                navbar={{width:navBarWidth, breakpoint:"md", collapsed:{mobile:!mobileSiderOpen}}}
                footer={{height: bottomNavHeight, collapsed: !isPWAMobile}}
            >
                <Header />
                <NavBar Title={Title} />

                <AppShell.Main
                    pt={isPWAMobile
                        ? `calc(env(safe-area-inset-top) + var(--mantine-spacing-md))`
                        : `calc(${rem(headerHeight)} + var(--mantine-spacing-md))`
                    }
                    style={{backgroundColor: "var(--mantine-color-scheme-dark)", height: "100vh"}}
                >
                    <ErrorBoundary FallbackComponent={ErrorFallback}>
                        <div style={{paddingRight: 8, paddingLeft: 8, height:"100%"}}>
                            {children}
                        </div>
                    </ErrorBoundary>

                </AppShell.Main>

                {isPWAMobile && (
                    <AppShell.Footer style={{borderTop: 'none'}}>
                        <GarageBottomNav />
                    </AppShell.Footer>
                )}

            </AppShell>
        </>
    );
};
