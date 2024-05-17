import {
    Box,
    Stack,
    TextInput,
    Group,
    ActionIcon,
    MantineNumberSize,
    GroupPosition,
    Tooltip,
    MediaQuery, useMantineTheme, Switch
} from "@mantine/core";
import {IconCirclePlus, IconInfoCircle, IconRefresh, IconSearch} from "@tabler/icons-react";
import {DataTable, DataTableSortStatus} from "mantine-datatable";
import React, {CSSProperties, useEffect, useState} from "react";
import { DataTableColumn } from "mantine-datatable/dist/types/DataTableColumn";
import { DataTableProps } from "mantine-datatable/dist/types";
import {BaseRecord, CrudFilter, CrudFilters, HttpError, useParsed, useResource, useTable} from "@refinedev/core";
import { Beneficiary } from "../../types/beneficiary";
import { PAGE_SIZE } from "../../constants";
import {useDebouncedValue, useToggle} from "@mantine/hooks";
import { useMany, useGetToPath, useGo} from "@refinedev/core";
import { Vehicle } from "../../types/vehicle";
import {CompleteContract} from "../../types/contract";
import {User} from "../../types/auth";

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
    elementSpacing?: MantineNumberSize;
    searchBarPosition?: GroupPosition;
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
    othersProps?: DataTableProps<T>;
};

function ContractTable<T extends BaseRecord>({
                                                 searchPlaceHolder,
                                                 columns,
                                                 defaultSortedColumn,
                                                 styles,
                                                 elementSpacing = "xs",
                                                 searchBarPosition = "apart",
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

    const go = useGo();
    const getToPath = useGetToPath();
    const {resource: contractResourceItem} = useResource("contract");

    const {params: urlParams} = useParsed()
    const urlSearch = urlParams?.filters?.find((filter: any) => filter.field === "search")?.value

    const [search, setSearch] = useState(urlSearch || "");
    const [debouncedSearch] = useDebouncedValue(search, 200, { leading: true });

    const [showArchived, toggleArchived] = useToggle([0,1]);

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


    /*
        ##############
        ## VEHICLES ##
        ##############
     */
    const vehicleIds = data.map((contract) => contract.vehicle);
    console.log("vehicleIds",vehicleIds)

    const { data: vehicleMany, isLoading } = useMany<Vehicle>({
        resource: "vehicle",
        ids: vehicleIds,
        queryOptions: {
            enabled: vehicleIds.length > 0,
        },
    });

    if(vehicleMany){
        data = data.map((contract) => {
            const vehicle = vehicleMany.data?.find(
                (vehicle) => vehicle.id === contract.vehicle
            );
            return { ...contract, vehicle: vehicle };
        });
    }


    /*
        ###################
        ## BENEFICIARIES ##
        ###################
     */
    const beneficiaryIds = data.map((contract) => contract.beneficiary);

    const { data: beneficiaryMany } = useMany<Beneficiary>({
        resource: "beneficiary",
        ids: beneficiaryIds,
        queryOptions: {
            enabled: beneficiaryIds.length > 0,
        },
    });

    if(beneficiaryMany){
        data = data.map((contract) => {
            const beneficiary = beneficiaryMany.data?.find(
                (beneficiary) => beneficiary.id === contract.beneficiary
            );
            return { ...contract, beneficiary };
        });
    }

    /*
        ###################
        ## REFERENTS ##
        ###################
     */
    const referentIds = data.map((contract) => contract.referent);
    const { data: referentMany } = useMany<User>({
        resource: "referent",
        ids: referentIds,
        queryOptions: {
            enabled: referentIds.length > 0,
        },
    });

    if(referentMany){
        data = data.map((contract) => {
            const referent = referentMany.data?.find(
                (referent) => referent.id === contract.referent
            );
            return { ...contract, referent };
        });
    }


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


    const rowClickHandler = (contract: T, rowIndex: number) => {
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
                        <Group style={{ alignItems: "center", ...styles?.buttons }}>
                            {/* Ajout du selector si demandé par l'utilisateur*/}
                            {categoriesSelector}

                            {extraButtons}
                            <Tooltip label={"Cette fonctionnalité est à venir. La visualisation des contrats archivés n'est pas disponible."}>
                                <span>
                                    <Switch
                                        label="Archives"
                                        value={showArchived}
                                        disabled={true}
                                        onChange={(value) => toggleArchived()}
                                    />
                                </span>

                            </Tooltip>


                            {withAddIcon && (
                                <Tooltip label={"Nouveau"} position={"bottom"} openDelay={200} >
                                    <ActionIcon
                                        style={{ flex: "initial" }}
                                        size={33}
                                        color="green"
                                        onClick={() => addCallback ? addCallback() : ""}
                                    >
                                        <IconCirclePlus size={33} />
                                    </ActionIcon>
                                </Tooltip>
                            )}

                            {withReloadIcon && (
                                <Tooltip label={"Rafraichir"} position={"bottom"} openDelay={200} >
                                    <ActionIcon
                                        style={{ flex: "initial" }}
                                        size={33}
                                        color="blue"
                                        onClick={() => reloadCallback()}
                                    >
                                        <IconRefresh size={33} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </Group>
                    )}
                </Group>
            )}

            {secondBarNodes}

            <Box
                style={{
                    flex: "1 1 auto",
                    overflow: "hidden",
                }}
            >
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
                    page={((data.length==0 )? undefined : currentPage ) as number}
                    onPageChange={setCurrentPage}
                    recordsPerPage={apiPageSize}
                    style={styles?.datatable}
                    onRowClick={rowClickHandler}
                    {...othersProps}
                />
            </Box>
        </Stack>
    );
}

export default ContractTable;
