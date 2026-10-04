import {useOne, useShow} from "@refinedev/core";
import {Beneficiary} from "../../types/beneficiary";
import {useEffect, useMemo, useRef, useState} from "react";
import {CompleteContract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import VehicleBadge from "../../components/Vehicle/VehicleBadge";
import {Badge, Group, Paper, Stack, Tabs, Text, Title, useMantineTheme} from "@mantine/core";
import ContractTable from "../../components/contract/ContractTable";
import BeneficiaryBadge from "../../components/beneficiary/BeneficiaryBadge";
import VehicleCard from "../../components/Vehicle/VehicleCard";
import ContractExtraActionMenu from "../../components/contract/ContractExtraActionMenu";
import OnePDFButton from "../../components/contract/OnePDFButton";
import ContractModal from "../../components/contract/ContractModal";
import EndContractModal from "../../components/contract/EndContractModal";
import useContractModalForm from "../../hooks/contract/useContractModalForm";
import useEndContractForm from "../../hooks/useEndContractForm";
import ContractStatusBadge from "../../components/contract/ContractStatusBadge";
import ContractEditButton from "../../components/contract/ContractEditButton";
import {humanizeDate} from "../../constants";
import ContractSearchTooltip from "../../components/contract/ContractSearchTooltip";
import VehicleActions from "../../components/Vehicle/VehicleActions";
import {DataTableColumn} from "mantine-datatable";
import {Show} from "../../components/forkedFromRefine/Show";
import {useHeadroom, useMediaQuery} from "@mantine/hooks";
import {ErrorComponent} from "../../components/ErrorComponent";
import CanAccess from "../../components/CanAccess";
import MileageHistoryChart from "../../components/garage/MileageHistoryChart";
import {IconHistory, IconFileText, IconTool} from "@tabler/icons-react";
import {MaintenanceSummary} from "../../types/garage";
import useAccessControl from "../../hooks/useAccessControl";
import {MaintenanceTab} from "../../components/garage/maintenance/MaintenanceTab";
import {maintenanceBadge} from "../../components/garage/maintenance/maintenanceUtils";
import {MaintenanceInfoLine} from "../../components/garage/maintenance/MaintenanceInfoLine";
import VehicleMobileHeader from "../../components/Vehicle/VehicleMobileHeader";

const VehicleShow = (props: any) => {

    const theme = useMantineTheme();
    const smallerThanMd = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, false, {getInitialValueInEffect: false});
    // Même état que le header de l'application (layout) : épinglé hors mode standalone, il recouvre le haut de l'écran
    const headerPinned = useHeadroom({fixedAt: 52});
    const isStandalone = useMediaQuery('(display-mode: standalone)', false);
    // En standalone, le layout superpose une bande safe-area fixe : les onglets collants se placent dessous
    const stickyTop = isStandalone ? "env(safe-area-inset-top)" : headerPinned ? 52 : 0;

    const { queryResult: showResponse } = useShow<Vehicle>()
    const vehicle  = showResponse.data?.data;

    // Synthèse d'entretien chargée une seule fois : onglet, pastille et ligne Informations.
    // Jamais demandée sans garage.view_vehicle (un 403 déclencherait une notification d'erreur).
    const {isAuthorized} = useAccessControl();
    const canViewGarage = !!isAuthorized('garage.view_vehicle');
    const {data: maintenanceData, isLoading: maintenanceLoading, isError: maintenanceError, refetch: refetchMaintenance} = useOne<MaintenanceSummary>({
        resource: 'garage/maintenance',
        id: vehicle?.id,
        queryOptions: {enabled: vehicle?.id != null && canViewGarage},
    });
    // Les échéances km dépendent du kilométrage : resynchronise après une édition du véhicule sur cette page
    const lastKilometer = useRef(vehicle?.kilometer);
    useEffect(() => {
        if (vehicle?.kilometer === undefined) return;
        if (lastKilometer.current !== undefined && lastKilometer.current !== vehicle.kilometer && canViewGarage) refetchMaintenance();
        lastKilometer.current = vehicle.kilometer;
    }, [vehicle?.kilometer, canViewGarage, refetchMaintenance]);
    const maintenance = maintenanceData?.data;
    const badge = maintenance ? maintenanceBadge(maintenance.counts) : null;

    // Tabs contrôlés : le défaut dépend de whoami (asynchrone) tant que l'utilisateur n'a rien choisi
    const [chosenTab, setChosenTab] = useState<string | null>(null);
    const defaultTab = isAuthorized(['garage.view_vehicle', 'garage.manage_intervention']) ? 'maintenance' : 'contracts';
    const activeTab = chosenTab ?? defaultTab;

    // Ligne « Entretien » des Informations : bascule sur l'onglet, fait défiler jusqu'aux onglets
    // et éclaire brièvement l'onglet pour montrer où l'on arrive.
    const tabsRef = useRef<HTMLDivElement>(null);
    const [maintenanceTabFlash, setMaintenanceTabFlash] = useState(false);
    const goToMaintenanceTab = () => {
        setChosenTab('maintenance');
        tabsRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        setMaintenanceTabFlash(true);
    };
    useEffect(() => {
        if (!maintenanceTabFlash) return;
        const timeout = setTimeout(() => setMaintenanceTabFlash(false), 900);
        return () => clearTimeout(timeout);
    }, [maintenanceTabFlash]);

    const editModalForm = useContractModalForm({action: "edit"});
    const {modal: { show: showEditModal}} = editModalForm;

    const endModalForm = useEndContractForm();
    const {modal: { show: showEndModal}} = endModalForm;


    const columns = useMemo<DataTableColumn<CompleteContract>[]>(
        () => [
            {
                accessor: 'beneficiary',
                title: 'Bénéficiaire',
                sortable: true,
                render: (contract) => {
                    const beneficiary = contract.beneficiary as Beneficiary
                    return beneficiary.hasOwnProperty("id") ? <BeneficiaryBadge beneficiary={beneficiary}/> : "Loading..."
                }
            },
            {
                accessor: 'start_date', //normal accessorKey
                title: 'Début',
                sortable: true,
                render: (contract) => (humanizeDate(contract.start_date)),
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
                render: (contract) => (humanizeDate(contract.end_date)),
            },
            {
                accessor: "status",
                title:"Status",
                textAlignment:"center",
                sortable: true,
                render: (contract) => (<ContractStatusBadge contract={contract}/>),
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: "action",
                title:"Actions",
                render: (contract) => {
                    return (
                        <Group>
                            <ContractEditButton  contract={contract} showEditModal={showEditModal} />
                            <OnePDFButton contract={contract}/>
                            <ContractExtraActionMenu contract={contract} showEndModal={showEndModal}/>
                        </Group>
                    );
                },
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            }
        ],
        [],
    );

    // If the vehicle is not found, show an error
    if(showResponse.error?.statusCode === 404) return <ErrorComponent errorMessage={"Le vehicule n'existe pas ou n'est pas accessible"}/>;

    return (
        <>
            <ContractModal {...editModalForm}/>
            <EndContractModal {...endModalForm}/>

            <Stack style={{height:"100%"}} gap={isMobile ? "xs" : undefined}>

                {isMobile ? (
                    <>
                        <Show
                            title={<Text fw={700} truncate><VehicleBadge vehicle={vehicle} noLink noColor/></Text>}
                            wrapperProps={{flex:"none", p:"xs", style:{minWidth:0}}}
                            headerProps={{wrap:"nowrap"}}
                            hideButtonText
                            contentProps={{style:{padding:0}}}
                        />
                        <VehicleMobileHeader
                            vehicle={vehicle}
                            infoFooter={canViewGarage && maintenance ? (close) => (
                                <MaintenanceInfoLine summary={maintenance} onClick={() => {close(); goToMaintenanceTab();}}/>
                            ) : undefined}
                        />
                    </>
                ) : (
                    <>
                        <Show title={<Title><VehicleBadge vehicle={vehicle} noLink noColor/> </Title>} wrapperProps={{flex:"none"}} contentProps={{style:{padding:0}}}/>

                        <Group grow style={{alignItems:"stretch"}}>
                            <VehicleCard
                                vehicle={vehicle}
                                withEdit
                                style={{flexGrow:2, maxWidth:"100%"}}
                                footer={canViewGarage && maintenance ? (
                                    <MaintenanceInfoLine summary={maintenance} onClick={goToMaintenanceTab}/>
                                ) : undefined}
                            />
                            <VehicleActions vehicle={vehicle} style={{flexGrow:1, maxWidth:"100%"}}/>
                        </Group>
                    </>
                )}

                {/* L'onglet Entretien grandit avec son contenu (la page défile) ; les autres onglets restent à la hauteur de l'écran */}
                <Paper ref={tabsRef} shadow="sm" p={isMobile ? "xs" : "md"} style={{flex: activeTab === 'maintenance' ? "0 0 auto" : "auto", minHeight:(smallerThanMd ? "100vh" : 0), display: "flex", flexDirection: "column"}}>
                    <Tabs variant="outline" value={activeTab} onChange={setChosenTab} keepMounted={false} style={{display: "flex", flexDirection: "column", flex: "1 1 auto"}}>
                        <Tabs.List grow={isMobile} style={isMobile ? {position: "sticky", top: stickyTop, transition: "top 200ms ease", zIndex: 10, backgroundColor: "white"} : undefined}>
                            <CanAccess permKey="garage.view_vehicle">
                                <Tabs.Tab
                                    leftSection={<IconTool size={18}/>}
                                    style={{backgroundColor: maintenanceTabFlash ? "var(--mantine-color-blue-1)" : undefined, transition: "background-color 600ms ease"}}
                                    rightSection={badge ? <Badge size="sm" circle color={badge.color}>{badge.count}</Badge> : undefined}
                                    value="maintenance"
                                >
                                    Entretien
                                </Tabs.Tab>
                            </CanAccess>
                            <Tabs.Tab leftSection={<IconFileText size={18}/>} value="contracts">Contrats</Tabs.Tab>
                            <CanAccess permKey="garage.view_vehicle">
                                <Tabs.Tab leftSection={<IconHistory size={18}/>} value="mileage">{isMobile ? "Km" : "Historique kilométrique"}</Tabs.Tab>
                            </CanAccess>
                        </Tabs.List>

                        <CanAccess permKey="garage.view_vehicle">
                            <Tabs.Panel value="maintenance" p="md">
                                {vehicle && (
                                    <MaintenanceTab
                                        summary={maintenance}
                                        isLoading={maintenanceLoading}
                                        isError={maintenanceError}
                                    />
                                )}
                            </Tabs.Panel>
                        </CanAccess>

                        <Tabs.Panel value="contracts" style={{flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems:"center", gap:"10px", paddingRight:20, paddingLeft:20, paddingTop:10}}>
                            <ContractTable
                                searchPlaceHolder={"Rechercher un contrat"}
                                columns={columns}
                                withReloadIcon
                                /*@ts-ignore*/
                                verticalSpacing="md"
                                style={{flex: "auto", minHeight:0}}
                                permanentFilters={[{field: "vehicle", operator: "in", value: [vehicle?.id]}]}
                                syncWithLocation={false}
                                defaultSortedColumn="start_date"
                                defaultSortedDirection="desc"
                                searchInfoTooltip={ContractSearchTooltip}
                                defaultArchived={vehicle?.archived? true : undefined}
                                withArchivedSwitch={!vehicle?.archived}
                            />
                        </Tabs.Panel>

                        <CanAccess permKey="garage.view_vehicle">
                            <Tabs.Panel value="mileage" p="md">
                                {vehicle && (
                                    <MileageHistoryChart
                                        vehicleId={vehicle.id}
                                        currentKilometer={vehicle.kilometer}
                                    />
                                )}
                            </Tabs.Panel>
                        </CanAccess>

                    </Tabs>
                </Paper>

            </Stack>
        </>
    )

}

export default VehicleShow;
