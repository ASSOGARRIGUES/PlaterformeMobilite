import {IconList, IconPower, IconDashboard, IconBug} from "@tabler/icons-react";
import React, { CSSProperties } from "react";
import {
    CanAccess,
    ITreeMenu,
    useIsExistAuthentication,
    useLink,
    useLogout,
    useMenu,
    useActiveAuthProvider,
    useRefineContext,
    useTitle,
    useTranslate,
    useWarnAboutChange,
} from "@refinedev/core";
import {
    ThemedTitleV2,
    useThemedLayoutContext,
} from "@refinedev/mantine";
import {
    NavLink,
    ScrollArea,
    Tooltip,
    TooltipProps,
    useMantineTheme,
    useMantineColorScheme, AppShell, Group, Burger, Center, Stack,
} from "@mantine/core";
import type { RefineThemedLayoutV2SiderProps } from "@refinedev/mantine";
import {APP_TITLE, VERSION} from "../../constants";

const defaultNavIcon = <IconList size={20} />;

const NavBar: React.FC<RefineThemedLayoutV2SiderProps> = ({
                                                              render,
                                                              meta,
                                                              Title: TitleFromProps,
                                                              activeItemDisabled = false,
                                                          }) => {
    const theme = useMantineTheme();
    const { siderCollapsed, mobileSiderOpen, setMobileSiderOpen } =
        useThemedLayoutContext();

    const Link = useLink();

    const { defaultOpenKeys, menuItems, selectedKey } = useMenu({ meta });
    const isExistAuthentication = useIsExistAuthentication();
    const t = useTranslate();
    const { hasDashboard } = useRefineContext();
    const authProvider = useActiveAuthProvider();
    const { warnWhen, setWarnWhen } = useWarnAboutChange();
    const { mutate: mutateLogout } = useLogout({
        v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
    });


    const {colorScheme} = useMantineColorScheme()


    const borderColor =
        colorScheme === "dark" ? theme.colors.dark[6] : theme.colors.gray[2];

    const commonNavLinkStyles = {
        root: {
            display: "flex",
            marginTop: "12px",
            justifyContent:
                siderCollapsed && !mobileSiderOpen ? "center" : "flex-start",
        },
        leftSection: {
            marginRight: siderCollapsed && !mobileSiderOpen ? 0 : 12,
        },
        body: {
            display: siderCollapsed && !mobileSiderOpen ? "none" : "flex",
        },
    };

    const commonTooltipProps: Partial<TooltipProps> = {
        disabled: !siderCollapsed || mobileSiderOpen,
        position: "right",
        withinPortal: true,
        withArrow: true,
        arrowSize: 8,
        arrowOffset: 12,
        offset: 4,
    };

    const renderTreeView = (tree: ITreeMenu[], selectedKey?: string) => {
        return tree.map((item) => {
            const { icon, label, route, name, children } = item;

            const isSelected = item.key === selectedKey;
            const isParent = children.length > 0;

            const additionalLinkProps = isParent
                ? {}
                : { component: Link as any, to: route };

            const disablePointerStyle: CSSProperties =
                activeItemDisabled && isSelected ? { pointerEvents: "none" } : {};

            return (
                <CanAccess
                    key={item.key}
                    resource={name.toLowerCase()}
                    action="list"
                    params={{
                        resource: item,
                    }}
                >
                    <Tooltip label={label} {...commonTooltipProps}>
                        <NavLink
                            key={item.key}
                            label={siderCollapsed && !mobileSiderOpen ? null : label}
                            leftSection={icon ?? defaultNavIcon}
                            active={isSelected}
                            childrenOffset={siderCollapsed && !mobileSiderOpen ? 0 : 12}
                            defaultOpened={defaultOpenKeys.includes(item.key || "")}
                            pl={28}
                            styles={commonNavLinkStyles}
                            style={disablePointerStyle}
                            {...additionalLinkProps}
                            onClick={() => {setMobileSiderOpen(false)}}
                        >
                            {isParent && renderTreeView(children, selectedKey)}
                        </NavLink>
                    </Tooltip>
                </CanAccess>
            );
        });
    };

    const items = renderTreeView(menuItems, selectedKey);

    const dashboard = hasDashboard ? (
        <CanAccess resource="dashboard" action="list">
            <Tooltip
                label={t("dashboard.title", "Dashboard")}
                {...commonTooltipProps}
            >
                <NavLink
                    key="dashboard"
                    label={
                        siderCollapsed && !mobileSiderOpen
                            ? null
                            : t("dashboard.title", "Dashboard")
                    }
                    leftSection={<IconDashboard size={20} />}
                    component={Link as any}
                    to="/"
                    active={selectedKey === "/"}
                    styles={commonNavLinkStyles}
                />
            </Tooltip>
        </CanAccess>
    ) : null;

    const bugList = (
        <CanAccess resource="bug" action="list">
            <Tooltip
                label="Liste des bugs"
                {...commonTooltipProps}
            >
                <NavLink
                    key="buglist"
                    label={
                        siderCollapsed && !mobileSiderOpen
                            ? null
                            : "Liste des bugs"
                    }
                    leftSection={<IconBug size={20} />}
                    component={Link as any}
                    to="/buglist"
                    active={selectedKey === "/buglist"}
                    styles={commonNavLinkStyles}
                    style={{paddingLeft: 28}}
                />
            </Tooltip>
        </CanAccess>
    )


    const handleLogout = () => {
        if (warnWhen) {
            const confirm = window.confirm(
                t(
                    "warnWhenUnsavedChanges",
                    "Are you sure you want to leave? You have unsaved changes."
                )
            );

            if (confirm) {
                setWarnWhen(false);
                mutateLogout();
            }
        } else {
            mutateLogout();
        }
    };

    const logout = isExistAuthentication && (
        <Tooltip label={t("buttons.logout", "Déconnexion")} {...commonTooltipProps}>
            <NavLink
                key="logout"
                label={
                    siderCollapsed && !mobileSiderOpen
                        ? null
                        : t("buttons.logout", "Déconnexion")
                }
                leftSection={<IconPower size={20} />}
                pl={28}
                onClick={handleLogout}
                styles={commonNavLinkStyles}
            />
        </Tooltip>
    );

    const renderSider = () => {
        return (
            <>
                {dashboard}
                {items}
            </>
        );
    };

    return (
        <>
            {/*<Drawer hiddenFrom="md"*/}
            {/*  opened={mobileSiderOpen}*/}
            {/*  onClose={() => setMobileSiderOpen(false)}*/}
            {/*  size={200}*/}
            {/*  zIndex={1200}*/}
            {/*  withCloseButton={false}*/}
            {/*  styles={{*/}
            {/*    content: {*/}
            {/*      overflow: "hidden",*/}
            {/*    },*/}
            {/*  }}*/}
            {/*>*/}
            {/*  <AppShell.Section*/}
            {/*    pl={8}*/}
            {/*    style={{*/}
            {/*      height: "64px",*/}
            {/*      display: "flex",*/}
            {/*      alignItems: "center",*/}
            {/*      paddingLeft: "10px",*/}
            {/*      borderBottom: `1px solid ${borderColor}`,*/}
            {/*    }}*/}
            {/*  >*/}
            {/*    <RenderToTitle collapsed={false} />*/}
            {/*  </AppShell.Section>*/}
            {/*  <AppShell.Section component={ScrollArea} grow mx="-xs" px="xs">*/}
            {/*    {renderSider()}*/}
            {/*  </AppShell.Section>*/}
            {/*</Drawer>*/}

            {/*<Box*/}
            {/*    visibleFrom="md"*/}
            {/*  style={{*/}
            {/*    width: drawerWidth(),*/}
            {/*    transition: "width 200ms ease, min-width 200ms ease",*/}
            {/*    flexShrink: 0,*/}
            {/*  }}*/}
            {/*/>*/}

            <AppShell.Navbar
                style={{
                    overflow: "hidden",
                    // transition: "width 200ms ease, min-width 200ms ease",
                    // position: "fixed",
                    // top: 0,
                    height: "100vh",
                    zIndex: 199,
                }}
            >
                <AppShell.Section
                    h="52px"
                    // pl={siderCollapsed ? 0 : 16}
                    // pr={siderCollapsed ? 0 : 16}
                    // align="center"
                    // justify={siderCollapsed ? "center" : "flex-start"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        borderBottom: `1px solid ${borderColor}`,
                    }}
                >
                    <Group style={{flex:"auto"}}>
                        <Burger opened={mobileSiderOpen} onClick={()=>setMobileSiderOpen(!mobileSiderOpen)} hiddenFrom="sm" size="sm" pl={18} />
                        <Center style={{flex:"auto"}}>
                            <ThemedTitleV2
                                // collapsed is a boolean value that indicates whether the <Sidebar> is collapsed or not
                                collapsed={siderCollapsed}
                                // wrapperStyles={{paddingLeft: 18}}
                                text={APP_TITLE}
                            />
                        </Center>
                    </Group>
                </AppShell.Section>

                <AppShell.Section
                    grow
                    component={ScrollArea}
                    mx="-xs"
                    // style={{
                    //   ".mantine-ScrollArea-viewport": {
                    //     borderRight: `1px solid ${borderColor}`,
                    //     borderBottom: `1px solid ${borderColor}`,
                    //   },
                    // }}
                >
                    {renderSider()}
                </AppShell.Section>

                <AppShell.Section
                style={{paddingBottom: 40}}
                >
                    {bugList}
                    {logout}
                    <span style={{position:"absolute", bottom:5, left:20}}>{VERSION}</span>
                </AppShell.Section>
            </AppShell.Navbar>
        </>
    );
};

export default NavBar;