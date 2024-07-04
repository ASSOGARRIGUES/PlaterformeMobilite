import {
    Box,
    Stack,
    TextInput,
    Group,
    ActionIcon,
    Tooltip,
    useMantineTheme, Switch
} from "@mantine/core";
import {IconCirclePlus, IconInfoCircle, IconRefresh, IconSearch} from "@tabler/icons-react";
import {
    DataTable,
    DataTableColumn,
    DataTableProps,
    DataTableRowClickHandler,
    DataTableSortStatus
} from "mantine-datatable";
import React, {CSSProperties, useEffect, useState} from "react";
import {
    BaseRecord,
    CrudFilters,
    HttpError,
    useParsed,
    useResource,
    useTable
} from "@refinedev/core";
import { PAGE_SIZE } from "../../constants";
import {useDebouncedValue, useMediaQuery} from "@mantine/hooks";
import { useGetToPath, useGo} from "@refinedev/core";
import {MantineSpacing} from "@mantine/core/lib/core";
import {GroupProps} from "@mantine/core/lib/components/Group/Group";
/*
Ce composant donne une datable triable avec un champ de recherche et la logique de tri intégré.
Les columns triable et recherchable sont les colones avec l'attribut (sortable: true).

defaultSortedColumn : Permet de specifié l'accessor de la colonne à trié par défaut (par défaut il s'agit de la première colone)

Il est possible de gérer les styles des composants avec la props styles.
        styles = {{input: {style of search field}, datable: {style of datatable}}}

Il est possible d'ajouter un bouton d'ajout et un bouton de reload. Dans ce cas il faut passer le callback correspondant:
   withAddIcon -> addCallback
   withReloadicon -> reloadCallback
Les logiques d'ajout et de reload sont à implémenter dans leur callback
il est possible d'ajouter des boutons grâce à la props "extraButtons"
categoriesSelector : Doit contenir un noeuds react qui sera affiché contre la barre de recherche (Permet de mettre un selecteur de categorie par exemple)
secondBarNodes: Liste de Nodes qui seront ajouter sous la barre principale (champ de recherche, boutons, ect)

 */

type SearchableDataTableProps<T> = {
    searchPlaceHolder: string;
    columns: DataTableColumn<T>[];
    defaultSortedColumn?: keyof T;
    defaultSortedDirection?: "asc" | "desc";
    styles?: any;
    elementSpacing?: MantineSpacing;
    searchBarPosition?: GroupProps["justify"];
    withAddIcon?: boolean;
    withReloadIcon?: boolean;
    addCallback?: () => void;
    extraButtons?: any;
    categoriesSelector?: any;
    secondBarNodes?: any;
    style?: CSSProperties;
    permanentFilters?: CrudFilters;
    syncWithLocation?: boolean;
    withoutSearch?: boolean;
    pageSize?: number;
    searchInfoTooltip?: React.ReactNode;
    defaultArchived?: boolean;
    withArchivedSwitch?: boolean;
    othersProps?: DataTableProps<T>;
};

function ContractTable<T extends BaseRecord>({
                                                 searchPlaceHolder,
                                                 columns,
                                                 defaultSortedColumn,
                                                 styles,
                                                 elementSpacing = "xs",
                                                 searchBarPosition = "space-between",
                                                 withAddIcon,
                                                 withReloadIcon,
                                                 addCallback,
                                                 extraButtons,
                                                 categoriesSelector,
                                                 secondBarNodes,
                                                 style,
                                                 permanentFilters,
                                                 syncWithLocation,
                                                 withoutSearch,
                                                 pageSize = PAGE_SIZE,
                                                 defaultSortedDirection = "asc",
                                                 defaultArchived,
                                                 withArchivedSwitch = true,
                                                 searchInfoTooltip,
                                                 ...othersProps
                                             }: SearchableDataTableProps<T>) {
    const [sortStatus, setSortStatus] = useState({
        columnAccessor: defaultSortedColumn
            ? defaultSortedColumn
            : (columns[0].accessor as keyof T),
        direction: defaultSortedDirection,
    });

    const theme = useMantineTheme();
    const smallerThanMd = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);

    const go = useGo();
    const getToPath = useGetToPath();
    const {resource: contractResourceItem} = useResource("contract");

    const {params: urlParams} = useParsed()
    const urlSearch = urlParams?.filters?.find((filter: any) => filter.field === "search")?.value // Retrieve search filter from url

    const [search, setSearch] = useState(urlSearch || "");
    const [debouncedSearch] = useDebouncedValue(search, 200, { leading: true });

    const urlArchived = urlParams?.filters?.find((filter: any) => filter.field === "archived")?.value // Retrieve archived filter from url
    const [showArchived, setShowArchived] = useState<false | true>(urlArchived!==undefined ? urlArchived==="1" : false);

    useEffect(() => {
        if(defaultArchived===undefined) return
        setShowArchived(defaultArchived)
    }, [defaultArchived]);

    const {
        tableQueryResult,
        current: currentPage,
        setCurrent: setCurrentPage,
        pageSize: apiPageSize,
        setSorters,
        setFilters,
    } = useTable<T, HttpError>({
        resource: "contract",
        syncWithLocation: syncWithLocation === undefined ? true : syncWithLocation,
        pagination: { pageSize: pageSize },
        sorters: {
            initial: [
                {
                    field: String(sortStatus.columnAccessor),
                    order: sortStatus.direction,
                },
            ],
        },
        filters: {
            initial: [{ field: "search", operator: "eq", value: search }, {field:"archived", operator:"eq", value: showArchived?1:0}],
            permanent: permanentFilters ? permanentFilters : [],
        },
    });

    let data = tableQueryResult?.data?.data ?? [];


    //Data object is now complete

    useEffect(() => {
        setSorters([
            { field: String(sortStatus.columnAccessor), order: sortStatus.direction },
        ]);
    }, [sortStatus]);


    //On vérifie que les paramètes passés sont consistant:

    //Vérification de la présence des callbacks si add
    if (withAddIcon && !addCallback) {
        throw "withAddIcon option require addCallback. \n addCallback should be a function that handle add logic";
    }

    useEffect(() => {
        setFilters([{ field: "search", operator: "eq", value: debouncedSearch }, {field:"archived", operator:"eq", value: showArchived?1:0}]);
    }, [debouncedSearch, showArchived]);

    const reloadCallback = () => {
        tableQueryResult.refetch();
    };


    const rowClickHandler:DataTableRowClickHandler<T> = ({record:contract, index, event}) => {
        const path = getToPath({
            resource: contractResourceItem,
            action: "show",
            meta: {
                id: contract.id
            }
        });

        go({
            to: path
        });
    }


    return (
         <Stack gap={elementSpacing} style={{ height: "100%", width:"100%", ...style}}>
            {(withAddIcon || withReloadIcon || extraButtons || !withoutSearch) && (
                <Group
                    gap="xs"
                    justify={searchBarPosition}
                    style={{justifyContent: withoutSearch? "end":undefined, ...styles?.searchBar}}
                >
                    {/* Ajout du champ de recherche si withoutSearch n'est pas défini*/}
                    {!withoutSearch && (
                        <Group style={{flex: "1 2 auto", maxWidth:"40em"}} gap="xs">
                            <TextInput
                                placeholder={searchPlaceHolder}
                                leftSection={<IconSearch size={14} stroke={1.5} />}
                                style={{flex: "auto", maxWidth:"35em", ...styles?.input}}
                                value={search}
                                onChange={(event) => setSearch(event.currentTarget.value)}
                            />

                            {searchInfoTooltip && (
                                <Tooltip label={searchInfoTooltip} position="bottom">
                                    <IconInfoCircle className={"mantine-visible-from-md"} color={theme.colors.blue[6]} />
                                </Tooltip>
                            )}
                        </Group>
                    )}

                    {/* Ajout des boutons d'ajout et de refresh si demandé par l'utilisateur*/}
                    {(withAddIcon || withReloadIcon || extraButtons || withArchivedSwitch) && (
                        <Group style={{alignItems: "center", ...styles?.buttons}}>
                            {/* Ajout du selector si demandé par l'utilisateur*/}
                            {categoriesSelector}

                            {extraButtons}
                            {withArchivedSwitch && (
                                <Switch
                                    visibleFrom="md"
                                    label="Archives"
                                    checked={showArchived}
                                    onChange={(event) => setShowArchived(!showArchived)}
                                />
                            )}

                            {withAddIcon && (
                                <Tooltip label={"Nouveau"} position={"bottom"} openDelay={200} >
                                    <ActionIcon  style={{flex:"initial"}} size={35} variant="subtle" radius="lg" color = "green" onClick={()=>addCallback ? addCallback() : ""}>
                                        <IconCirclePlus size={33}/>
                                    </ActionIcon>
                                </Tooltip>
                            )}

                            {withReloadIcon && (
                                <Tooltip label={"Rafraichir"} position={"bottom"} openDelay={200} >
                                    <ActionIcon style={{flex:"initial"}} size={35} variant="subtle" radius="lg" color = "blue" onClick={()=>reloadCallback()}>
                                        <IconRefresh size={33}/>
                                    </ActionIcon>
                                </Tooltip>
                            )}

                        </Group>
                    )}

                </Group>
            )}

            {secondBarNodes}

            <Box style={{
                flex: "1 1 auto",
                overflow: "hidden"
            }}>
                <DataTable<T>
                    minHeight={150}
                    striped
                    highlightOnHover
                    records={data}
                    columns={columns}
                    fetching={tableQueryResult.isFetching}
                    sortStatus={sortStatus as DataTableSortStatus}
                    onSortStatusChange={setSortStatus}

                    totalRecords={tableQueryResult.data?.total ?? 0}
                    page={currentPage}
                    onPageChange={setCurrentPage}
                    recordsPerPage={apiPageSize}

                    paginationText={smallerThanMd ? ({from, to, totalRecords}) => <></> : undefined}
                    paginationSize={smallerThanMd ? "xs" : undefined}

                    style = {styles?.datatable}
                    onRowClick={rowClickHandler}

                    {...othersProps}
                />
    </Box>
</Stack>
);
}

export default ContractTable;
