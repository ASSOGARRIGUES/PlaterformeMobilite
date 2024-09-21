import {  Refine } from "@refinedev/core";
import {
    ThemedTitleV2, ThemedLayoutContextProvider
} from "@refinedev/mantine";

import routerBindings, {
    CatchAllNavigate, DocumentTitleHandler,
    NavigateToResource,
} from "@refinedev/react-router-v6";

import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { authProvider } from "./providers/auth-provider";
import { Login } from "./pages/login";
import {API_URL, APP_TITLE} from "./constants";
import BeneficiaryList from "./pages/beneficiary/BeneficiaryList";
import {dataProvider} from "./providers/rest-data-provider";
import {createTheme, MantineProvider, Title} from "@mantine/core";
import VehicleList from "./pages/vehicle/VehicleList";
import ContractList from "./pages/contract/ContractList";
import BeneficiaryShow from "./pages/beneficiary/BeneficiaryShow";
import VehicleShow from "./pages/vehicle/VehicleShow";
import { ModalsProvider } from "@mantine/modals";
import Dashboard from "./pages/dashboard/Dashboard";
import {IconAddressBook, IconCar, IconDashboard} from "@tabler/icons-react";
import ContractIcon from "./assets/contract.svg";
import ContractShow from "./pages/contract/ContractShow";
import ContractCreate from "./pages/contract/ContractCreate";
import {Notifications} from "@mantine/notifications";
import {Authenticated} from "./components/forkedFromRefine/Authenticated";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import '@mantine/core/styles.css';
import './style/global.css'
import 'mantine-datatable/styles.css';
import {Layout} from "./components/layout";
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import {useNotificationProvider} from "./providers/notificationProvider";
import {BugReporterProvider} from "./context/BugReporterProvider";
import logSaver from "./logSaver";
import BugList from "./pages/bugtracker/BugList";
import ViewBroadcastModal from "./components/inappcom/ViewBroadcastModal";
import useAccessControl from "./providers/accessControlProvider";
import {UserActionsProvider} from "./context/UserActionsProvider";
import VehicleTransfer from "./pages/vehicle/VehicleTransfer";
import {ErrorComponent} from "./components/ErrorComponent";

function App() {


    //Override console.warn to intercept a specific warning message and prevent it from being displayed
    //This is a temporary workaround to prevent a warning message from being displayed
    //The warning message is displayed when the `id` prop is not passed to the `useForm` hook but there is no real problem because the id is passed to the show method of useModalForm
    const flagText = "If you don't use the `setId` method to set the `id`, you should pass the `id` prop to `useForm`. Otherwise, `useForm` will not be able to infer the `id` from the current URL with custom resource provided."

    const obj = console;
    const prop = obj["warn"];
    const origProp = prop;
    obj["warn"] = (...args) => { // (C)
        if(args.length > 0 && args[0].includes(flagText)) {
            return
        }
        return Reflect.apply(origProp, obj, args); // (E)
    }

    //Register the logSaver for the bug reporter
    logSaver.overrideConsole();

    //Add the customParseFormat plugin to dayjs
    dayjs.extend(customParseFormat);

    const theme = createTheme({

    })


    return (
        <BrowserRouter>
            <MantineProvider
                // theme={RefineThemes.Blue}
                theme={theme}
            >
                <ModalsProvider>
                    <Notifications position="bottom-right" zIndex={9999}/>
                    <Refine
                        dataProvider={dataProvider(API_URL)}
                        routerProvider={routerBindings}
                        authProvider={authProvider}
                        notificationProvider={useNotificationProvider}
                        resources={[
                            {
                                name:"dashboard",
                                list:"/",
                                meta: {
                                    label: "Tableau de bord",
                                    icon: <IconDashboard/>,
                                    permKey: true,
                                },
                            },
                            {
                                name: "beneficiary",
                                list: "beneficiary/",
                                show: "beneficiary/:id",
                                meta: {
                                    label: "Bénéficiaires",
                                    icon: <IconAddressBook/>,
                                    permissionGroup: 'api',
                                },
                            },
                            {
                                name: "vehicle",
                                list: "vehicle/",
                                show: "vehicle/:id",
                                meta: {
                                    label: "Véhicules",
                                    icon: <IconCar/>,
                                    permissionGroup: 'api',
                                },
                            },
                            {
                                name: "contract",
                                list: "contract/",
                                show: "contract/:id",
                                create: "contract/create",
                                meta: {
                                    label: "Contrats",
                                    icon: <img src = {ContractIcon} width="20px" style={{marginRight: 5}}/>,
                                    permissionGroup: 'api',
                                },
                            }
                        ]}
                        options={{
                            syncWithLocation: true,
                            warnWhenUnsavedChanges: false,
                            useNewQueryKeys: true,
                            disableTelemetry: true,
                            projectId: "CqrvHj-EYqRMF-oCbV7s",
                            reactQuery:{clientConfig:{defaultOptions:{queries:{
                                            retry:(failureCount, error: any)=> {
                                                if(error.statusCode === 401 || error.statusCode === 404){
                                                    return failureCount < 1
                                                }else {
                                                    return failureCount < 3
                                                }
                                            }
                                        }
                                    } } }
                        }}

                    >
                        <BugReporterProvider>
                            <Routes>
                                <Route
                                    element={
                                        <Authenticated
                                            key="authenticated-inner"
                                            fallback={<CatchAllNavigate to="/login" />}
                                        >
                                            <UserActionsProvider>
                                                <ThemedLayoutContextProvider>
                                                    <Layout Title={({ collapsed }) => (
                                                        <ThemedTitleV2
                                                            // collapsed is a boolean value that indicates whether the <Sidebar> is collapsed or not
                                                            collapsed={collapsed}
                                                            text={APP_TITLE}
                                                        />
                                                    )}>
                                                        <Outlet />
                                                    </Layout>
                                                </ThemedLayoutContextProvider>
                                            </UserActionsProvider>
                                        </Authenticated>
                                    }
                                >
                                    <Route
                                        index
                                        element={<Dashboard/>}
                                    />
                                    <Route path="/beneficiary">
                                        <Route index element={<BeneficiaryList />} />
                                        <Route path=":id" element={<BeneficiaryShow />} />
                                    </Route>
                                    <Route path="/vehicle">
                                        <Route index element={<VehicleList />} />
                                        <Route path=":id" element={<VehicleShow />} />
                                        <Route path=":id/transfer" element={<VehicleTransfer />} />
                                    </Route>
                                    <Route path="/contract">
                                        <Route index element={<ContractList />} />
                                        <Route path=":id" element={<ContractShow />} />
                                        <Route path="create" element={<ContractCreate />} />
                                    </Route>
                                    <Route path={"/buglist"} element={<BugList/>} />
                                    <Route path="*" element={<ErrorComponent />} />
                                </Route>

                                <Route
                                    element={
                                        <Authenticated
                                            key="authenticated-outer"
                                            fallback={<Outlet />}
                                        >
                                            <NavigateToResource />
                                        </Authenticated>
                                    }
                                >
                                    <Route path="/login" element={<Login />} />
                                </Route>
                            </Routes>

                            <ViewBroadcastModal/>
                            {/*<UnsavedChangesNotifier />*/}
                            {/*<DocumentTitleHandler />*/}

                        </BugReporterProvider>
                    </Refine>
                </ModalsProvider>
            </MantineProvider>
        </BrowserRouter>
    );
}

export default App;
