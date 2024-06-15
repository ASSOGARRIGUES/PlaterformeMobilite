import React from "react";
import {
    Box,
    Card,
    Group,
    ActionIcon,
    Stack,
    Title,
    LoadingOverlay, CardProps, BoxProps,
} from "@mantine/core";
import {
    useBack,
    useGo,
    useNavigation,
    useRefineContext,
    useResource,
    useUserFriendlyName,
    useRouterType,
    useToPath,
    useTranslate, BaseKey,
} from "@refinedev/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { RefinePageHeaderClassNames } from "@refinedev/ui-types";
import {
    DeleteButtonProps,
    ListButton,
    ListButtonProps,
    RefreshButton,
    RefreshButtonProps,
    EditButton,
    EditButtonProps,
    DeleteButton
} from "@refinedev/mantine";
import {GroupProps} from "@mantine/core/lib/components/Group/Group";


type ShowProps = {
    children?: React.ReactNode;
    resource?: string;
    recordItemId?: BaseKey ;
    canDelete?: boolean ;
    canEdit?: boolean ;
    dataProviderName?: string ;
    isLoading?: boolean;
    footerButtonProps?: GroupProps;
    headerButtonProps?: GroupProps;
    wrapperProps?: CardProps;
    contentProps?: BoxProps;
    headerProps?: GroupProps;
    goBack?: React.ReactNode;
    breadcrumb?: React.ReactNode;
    title?: React.ReactNode;
};

export const Show: React.FC<ShowProps> = (props) => {
    const {
        children,
        resource: resourceFromProps,
        recordItemId,
        canDelete,
        canEdit,
        dataProviderName,
        isLoading,
        footerButtonProps,
        headerButtonProps,
        wrapperProps,
        contentProps,
        headerProps,
        goBack: goBackFromProps,
        breadcrumb: breadcrumbFromProps,
        title,
    } = props;
    const translate = useTranslate();
    const {
        options: { breadcrumb: globalBreadcrumb } = {},
    } = useRefineContext();

    const routerType = useRouterType();
    const back = useBack();
    const go = useGo();
    const { goBack, list: legacyGoList } = useNavigation();
    const getUserFriendlyName = useUserFriendlyName();

    const {
        resource,
        action,
        id: idFromParams,
        identifier,
    } = useResource(resourceFromProps);

    const goListPath = useToPath({
        resource,
        action: "list",
    });

    const id = recordItemId ?? idFromParams;


    const hasList = resource?.list && !recordItemId;
    const isDeleteButtonVisible =
        canDelete ?? resource?.meta?.canDelete ?? resource?.canDelete;
    const isEditButtonVisible = canEdit ?? resource?.canEdit ?? !!resource?.edit;

    const listButtonProps: ListButtonProps | undefined = hasList
        ? {
            ...(isLoading ? { disabled: true } : {}),
            resource: routerType === "legacy" ? resource?.route : identifier,
        }
        : undefined;
    const editButtonProps: EditButtonProps | undefined = isEditButtonVisible
        ? {
            ...(isLoading ? { disabled: true } : {}),
            color: "primary",
            variant: "filled",
            resource: routerType === "legacy" ? resource?.route : identifier,
            recordItemId: id,
        }
        : undefined;
    const deleteButtonProps: DeleteButtonProps | undefined = isDeleteButtonVisible
        ? {
            ...(isLoading ? { disabled: true } : {}),
            resource: routerType === "legacy" ? resource?.route : identifier,
            recordItemId: id,
            onSuccess: () => {
                if (routerType === "legacy") {
                    legacyGoList(resource?.route ?? resource?.name ?? "");
                } else {
                    go({ to: goListPath });
                }
            },
            dataProviderName,
        }
        : undefined;
    const refreshButtonProps: RefreshButtonProps = {
        ...(isLoading ? { disabled: true } : {}),
        resource: routerType === "legacy" ? resource?.route : identifier,
        recordItemId: id,
        dataProviderName,
    };

    const loadingOverlayVisible = isLoading ?? false;

    const defaultHeaderButtons = (
        <>
            {hasList && <ListButton {...listButtonProps} />}
            {isEditButtonVisible && <EditButton {...editButtonProps} />}
            {isDeleteButtonVisible && <DeleteButton {...deleteButtonProps} />}
            <RefreshButton {...refreshButtonProps} />
        </>
    );

    const buttonBack =
        goBackFromProps === (false || null) ? null : (
            <ActionIcon
                onClick={
                    action !== "list" && typeof action !== "undefined"
                        ? routerType === "legacy"
                            ? goBack
                            : back
                        : undefined
                }
                variant="subtle"
            >
                {typeof goBackFromProps !== "undefined" ? (
                    goBackFromProps
                ) : (
                    <IconArrowLeft />
                )}
            </ActionIcon>
        );

    const headerButtons = defaultHeaderButtons;

    const footerButtons = null;

    return (
        <Card p="md" {...wrapperProps}>
            <LoadingOverlay visible={loadingOverlayVisible} />
            <Group justify="space-between" align="center" {...headerProps}>
                {/*<Stack gap="xs">*/}
                <Group gap="xs">
                    {buttonBack}
                    {title ?? (
                        <Title
                            order={3}
                            className={RefinePageHeaderClassNames.Title}
                        >
                            {translate(
                                `${identifier}.titles.show`,
                                `Show ${getUserFriendlyName(
                                    resource?.meta?.label ??
                                    resource?.options?.label ??
                                    resource?.label ??
                                    identifier,
                                    "singular",
                                )}`,
                            )}
                        </Title>
                    )}
                </Group>
                {/*</Stack>*/}
                <Group gap="xs" {...headerButtonProps}>
                    {headerButtons}
                </Group>
            </Group>
            {children && (
                <Box pt="sm" {...contentProps}>
                    {children}
                </Box>
            )}
            {footerButtons && (
                <Group justify="right" gap="xs" mt="md" {...footerButtonProps}>
                    {footerButtons}
                </Group>
            )}
        </Card>
    );
};
