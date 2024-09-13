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
import {DataTable, DataTableColumn, DataTableProps, DataTableSortStatus} from "mantine-datatable";
import React, {CSSProperties, useEffect, useState} from "react";
import {BaseRecord, CrudFilters, HttpError, LogicalFilter, useParsed, useTable} from "@refinedev/core";
import {PAGE_SIZE} from "../constants";
import {useDebouncedValue, useMediaQuery} from "@mantine/hooks";
import {MantineSpacing} from "@mantine/core/lib/core";
import {GroupProps} from "@mantine/core/lib/components/Group/Group";
import {PermissionType} from "../types/PermissionType";
import CanAccess from "./CanAccess";

export type ColumnFilter<T> = (accessor: keyof T, value: LogicalFilter[] | undefined, setValue: (filter: LogicalFilter[] | undefined) => void) => React.ReactNode

export type SearchableDataTableColumn<T>  = Omit<DataTableColumn<T>, "filter"> & {filter?: ColumnFilter<T>, filtering?: boolean, filteredKeys?: string[]}

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
    searchPlaceHolder?: string,
    columns: SearchableDataTableColumn<T>[],
    defaultSortedColumn?: keyof T,
    defaultSortedDirection?: "asc" | "desc";
    styles?: any,
    elementSpacing?: MantineSpacing;
    searchBarPosition?: GroupProps["justify"];
    withAddIcon?: boolean,
    withReloadIcon?: boolean,
    addPermKey?: PermissionType,
    addCallback?: ()=>void,
    extraButtons?: any,
    categoriesSelector?: any,
    secondBarNodes?: any,
    style?: CSSProperties;
    permanentFilters?: CrudFilters;
    withoutSearch?: boolean;
    pageSize?: number;
    searchInfoTooltip?: React.ReactNode
    resource?: string;
    defaultArchived?: boolean;
    withArchivedSwitch?: boolean;
    withTableBorder?: boolean;
} & Omit<DataTableProps<T>, "columns" | "groups" | "withTableBorder" | "customLoader">

function SearchableDataTable<T extends BaseRecord>({
                                                       searchPlaceHolder,
                                                       columns ,
                                                       defaultSortedColumn,
                                                       styles,
                                                       elementSpacing="xs",
                                                       searchBarPosition = "space-between",
                                                       withAddIcon,
                                                       withReloadIcon,
                                                       addCallback,
                                                       extraButtons,
                                                       categoriesSelector,
                                                       secondBarNodes,
                                                       style,
                                                       permanentFilters,
                                                       withoutSearch,
                                                       pageSize = PAGE_SIZE,
                                                       defaultSortedDirection = "asc",
                                                       searchInfoTooltip,
                                                       resource,
                                                       defaultArchived,
                                                       withArchivedSwitch = true,
                                                       withTableBorder = false,
                                                       addPermKey,
                                                       ...othersProps
                                                   }: SearchableDataTableProps<T>)
{

    //On vérifie que les paramètes passés sont consistant:
    //Vérification de la présence des callbacks si add
    if(withAddIcon && !addCallback){
        throw "withAddIcon option require addCallback. \n addCallback should be a function that handle add logic"
    }

    const [sortStatus, setSortStatus] = useState({
        columnAccessor: (defaultSortedColumn ? defaultSortedColumn : columns[0].accessor as keyof T),
        direction: defaultSortedDirection
    });

    const theme = useMantineTheme();
    const smallerThanMd = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);


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
        syncWithLocation: true,
        pagination: {pageSize: pageSize},
        resource: resource,
        sorters: {initial: [{field: String(sortStatus.columnAccessor), order: sortStatus.direction}]},
        filters: {
            initial: [{ field: "search", operator: "eq", value: search }, {field:"archived", operator:"eq", value: showArchived?1:0}],
            permanent: permanentFilters ? permanentFilters : []
        }
    });

    useEffect(() => {
        setSorters([{field: String(sortStatus.columnAccessor), order: sortStatus.direction}])
    }, [sortStatus]);

    const data = tableQueryResult?.data?.data ?? [];

    // #################################
    // #### Handle column filtering ####
    // #################################

    //Retrieve all the accessor of the columns
    const accessorList = columns.map((column) => column.accessor)

    //Retrieve the filtered keys for each column
    const filteredKeysGroupedByAccessor = columns.filter((column) => column.filter && column.filteredKeys).map((column) => ({accessor: column.accessor, filteredAccessors: column.filteredKeys})).reduce((acc, column) => {
        if(column.filteredAccessors === undefined) return acc // If the column has no filtered keys, we don't add it to the accumulator
        acc[column.accessor.toString()] = column.filteredAccessors
        return acc
    }, {} as {[key: string]: string[]})

    //Retrieve the filters from the url and associate them with the accessor
    //Sometimes we need to filter multiple field of the Model with the same Column (i.e same accessor) so we need to associate
    // the url filters (that are designated by the model field they are filtering) with the correct accessor.
    const urlFiltersValues = accessorList.map((accessor) => {
        const urlFilter = urlParams?.filters?.filter((filter) => filter.hasOwnProperty('field') && (filter as LogicalFilter).field === accessor) as LogicalFilter[] ?? [] // Retrieve filter that filters a model field with the same name as the accessor

        const associatedFilteredKeys = filteredKeysGroupedByAccessor[accessor as keyof typeof filteredKeysGroupedByAccessor] // Retrieve the filtered keys of the model fields associated with the accessor

        let associatedFilters: LogicalFilter[] = []
        if (associatedFilteredKeys) {
            associatedFilters = urlParams?.filters?.filter((filter) => filter.hasOwnProperty('field') && associatedFilteredKeys.includes((filter as LogicalFilter).field)) as LogicalFilter[] ?? [] // Retrieve filters that filters the associated model fields
        }

        return {
            accessor: accessor,
            filter: [...urlFilter, ...associatedFilters].filter((filter) => filter !== undefined)
        }
    })

    // @ts-ignore
    // const urlFilters: LogicalFilter[] | undefined = urlParams?.filters?.filter((filter) => filter.hasOwnProperty('field') && accessorList.includes(filter.field)) // Retrieve filters from url
    // const urlFiltersValue = urlFilters?.map((filter) => ({accessor: filter.field, filter: [filter]})) // Convert filters to the format used by the state
    const [filtersValues, setFiltersValues] = useState<{accessor: string, filter:LogicalFilter[] | undefined}[]>(urlFiltersValues ?? []); //This state will contain the CrudFilters for all the columns filter. it serve to send the filters to the backend and to store the state of the inputs of the filters


    /**
     * Get the value of the filter for a specific column from the global state filtersValues
     * @param accessor
     */
    const getFilterValue = (accessor: keyof T) => {
        return filtersValues?.find((filter) => filter.accessor === accessor)?.filter
    }

    /**
     * Get a function to set the value of the filter for a specific column
     * @param accessor
     */
    const setFilterValue = (accessor: keyof T) => {
        return (value: LogicalFilter[] | undefined) => {
            const newFilters = filtersValues?.filter((filter) => filter.accessor !== accessor) || []
            newFilters.push({accessor: accessor.toString(), filter: value})
            setFiltersValues(newFilters)
        }
    }


    // Build the column object with the filters functions
    const columnsWithFilter: DataTableColumn<T>[] = columns.map(({filter, ...others}) => ({
        ...others,
        filter: filter ? filter(others.accessor, getFilterValue(others.accessor), setFilterValue(others.accessor))  : undefined,
        filtering: getFilterValue(others.accessor)?.find((filter) => filter.value?.length > 0),
    }) as DataTableColumn<T>)



    // Update filters when search or showArchived change
    useEffect(() => {
        const userFilters : LogicalFilter[] = filtersValues.filter((filter) => filter.filter !== undefined).map((filter) => filter.filter as LogicalFilter[]).flat(1);
        setFilters([{ field: "search", operator: "eq", value: debouncedSearch }, {field:"archived", operator:"eq", value: showArchived?1:0}, ...userFilters]);
    }, [debouncedSearch, showArchived, filtersValues]);


    const reloadCallback = () => {
        tableQueryResult.refetch()
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
                                <CanAccess permKey={addPermKey ?? true}>
                                    <Tooltip label={"Nouveau"} position={"bottom"} openDelay={200} >
                                        <ActionIcon  style={{flex:"initial"}} size={35} variant="subtle" radius="lg" color = "green" onClick={()=>addCallback ? addCallback() : ""}>
                                            <IconCirclePlus size={33}/>
                                        </ActionIcon>
                                    </Tooltip>
                                </CanAccess>
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
                {/* @ts-ignore */}
                <DataTable
                    minHeight={150}
                    striped
                    highlightOnHover
                    records={data}
                    columns={columnsWithFilter}
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

                    withTableBorder={withTableBorder}
                    {...othersProps}
                />

            </Box>
        </Stack>
    );
}

export default SearchableDataTable;