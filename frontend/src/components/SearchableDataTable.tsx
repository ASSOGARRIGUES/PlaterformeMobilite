import {
    Box,
    Stack,
    TextInput,
    Group,
    ActionIcon,
    MantineNumberSize,
    GroupPosition,
    Tooltip,
    MediaQuery, useMantineTheme
} from "@mantine/core";
import {IconCirclePlus, IconInfoCircle, IconRefresh, IconSearch} from "@tabler/icons-react";
import {DataTable, DataTableSortStatus} from "mantine-datatable";
import React, {CSSProperties, useEffect, useState} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import {DataTableProps} from "mantine-datatable/dist/types";
import {BaseRecord, CrudFilters, HttpError, useParsed, useTable} from "@refinedev/core";
import {PAGE_SIZE} from "../constants";
import {useDebouncedValue} from "@mantine/hooks";

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
    searchPlaceHolder: string,
    columns: DataTableColumn<T>[],
    defaultSortedColumn?: keyof T,
    defaultSortedDirection?: "asc" | "desc";
    styles?: any,
    elementSpacing?: MantineNumberSize;
    searchBarPosition?: GroupPosition;
    withAddIcon?: boolean,
    withReloadIcon?: boolean,
    addCallback?: ()=>void,
    extraButtons?: any,
    categoriesSelector?: any,
    secondBarNodes?: any,
    style?: CSSProperties;
    defaultFilters?: CrudFilters;
    withoutSearch?: boolean;
    pageSize?: number;
    searchInfoTooltip?: React.ReactNode
    othersProps?: DataTableProps<T>
    resource?: string
}

function SearchableDataTable<T extends BaseRecord>({
                                                       searchPlaceHolder,
                                                       columns ,
                                                       defaultSortedColumn,
                                                       styles,
                                                       elementSpacing="xs",
                                                       searchBarPosition = "apart",
                                                       withAddIcon,
                                                       withReloadIcon,
                                                       addCallback,
                                                       extraButtons,
                                                       categoriesSelector,
                                                       secondBarNodes,
                                                       style,
                                                       defaultFilters,
                                                       withoutSearch,
                                                       pageSize = PAGE_SIZE,
                                                       defaultSortedDirection = "asc",
                                                       searchInfoTooltip,
                                                       resource,
                                                       ...othersProps
                                                   }: SearchableDataTableProps<T>)
{
    const [sortStatus, setSortStatus] = useState({
        columnAccessor: (defaultSortedColumn ? defaultSortedColumn : columns[0].accessor as keyof T),
        direction: defaultSortedDirection
    });

    const theme = useMantineTheme();


    const {params: urlParams} = useParsed()
    const urlSearch = urlParams?.filters?.find((filter: any) => filter.field === "search")?.value

    const [search, setSearch] = useState(urlSearch || "");
    const [debouncedSearch] = useDebouncedValue(search, 200, { leading: true });


    const {
        tableQueryResult,
        current: currentPage,
        setCurrent: setCurrentPage,
        pageSize: apiPageSize,
        setSorters,
        setFilters,
    } = useTable<T, HttpError>({
        syncWithLocation: true,
        resource: resource,
        pagination: {pageSize: pageSize},
        sorters: {initial: [{field: String(sortStatus.columnAccessor), order: sortStatus.direction}]},
        filters: {
            initial: [{ field: "search", operator: "eq", value: search }],
            permanent: defaultFilters ? defaultFilters : []
        }
    });

    useEffect(() => {
        setSorters([{field: String(sortStatus.columnAccessor), order: sortStatus.direction}])
    }, [sortStatus]);

    const data = tableQueryResult?.data?.data ?? [];



    //On vérifie que les paramètes passés sont consistant:

    //Vérification de la présence des callbacks si add
    if(withAddIcon && !addCallback){
        throw "withAddIcon option require addCallback. \n addCallback should be a function that handle add logic"
    }

    useEffect(() => {
        setFilters([{ field: "search", operator: "eq", value: debouncedSearch }]);
    }, [debouncedSearch]);


    const reloadCallback = () => {
        tableQueryResult.refetch()
    }


    return (
        <Stack spacing={elementSpacing} style={{ height: "100%", width:"100%", ...style}}>
            {(withAddIcon || withReloadIcon || extraButtons || !withoutSearch) && (
                <Group
                    spacing="xs"
                    position={searchBarPosition}
                    style={styles?.searchBar}
                >
                    {/* Ajout du champ de recherche si withoutSearch n'est pas défini*/}
                    {!withoutSearch && (
                        <Group style={{flex: "auto", maxWidth:"40em",}} spacing="xs">
                            <TextInput
                                placeholder={searchPlaceHolder}
                                icon={<IconSearch size={14} stroke={1.5} />}
                                style={{flex: "auto", maxWidth:"35em", ...styles?.input}}
                                value={search}
                                onChange={(event) => setSearch(event.currentTarget.value)}
                            />

                            {searchInfoTooltip && (
                                <MediaQuery smallerThan="md" styles={{display:"none"}}>
                                    <Tooltip label={searchInfoTooltip}>
                                        <IconInfoCircle color={theme.colors.blue[6]} />
                                    </Tooltip>
                                </MediaQuery>
                            )}
                        </Group>
                    )}

                    {/* Ajout des boutons d'ajout et de refresh si demandé par l'utilisateur*/}
                    {(withAddIcon || withReloadIcon || extraButtons) && (
                        <Group style={{alignItems: "center", ...styles?.buttons}}>
                            {/* Ajout du selector si demandé par l'utilisateur*/}
                            {categoriesSelector}

                            {extraButtons}

                            {withAddIcon && (
                                <Tooltip label={"Nouveau"} position={"bottom"} openDelay={200} >
                                    <ActionIcon  style={{flex:"initial"}} size={33} color = "green" onClick={()=>addCallback ? addCallback() : ""}>
                                        <IconCirclePlus size={33}/>
                                    </ActionIcon>
                                </Tooltip>
                            )}

                            {withReloadIcon && (
                                <Tooltip label={"Rafraichir"} position={"bottom"} openDelay={200} >
                                    <ActionIcon style={{flex:"initial"}} size={33} color = "blue" onClick={()=>reloadCallback()}>
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

                    style = {styles?.datatable}

                    {...othersProps}
                />

            </Box>
        </Stack>
    );
}

export default SearchableDataTable;