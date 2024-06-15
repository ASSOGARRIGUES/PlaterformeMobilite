import {  Refine } from "@refinedev/core";

import {
    ErrorComponent,
    RefineThemes,
    useNotificationProvider, ThemedTitleV2, ThemedLayoutContextProvider
} from "@refinedev/mantine";

import routerBindings, {
    CatchAllNavigate,
    DocumentTitleHandler,
    NavigateToResource,
    UnsavedChangesNotifier,
} from "@refinedev/react-router-v6";


import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { authProvider } from "./providers/auth-provider";
// import { Header } from "./components/header";
import { Login } from "./pages/login";
import {API_URL, APP_TITLE} from "./constants";
import BeneficiaryList from "./pages/beneficiary/BeneficiaryList";
import {dataProvider} from "./providers/rest-data-provider";
import {createTheme, MantineProvider, Title} from "@mantine/core";
import { MantineInferencer } from "@refinedev/inferencer/mantine";
import VehicleList from "./pages/vehicle/VehicleList";
import ContractList from "./pages/contract/ContractList";
import BeneficiaryShow from "./pages/beneficiary/BeneficiaryShow";
import VehicleShow from "./pages/vehicle/VehicleShow";
import { ModalsProvider } from "@mantine/modals";
import Dashboard from "./pages/dashboard/Dashboard";
import {IconDashboard} from "@tabler/icons-react";
import ContractShow from "./pages/contract/ContractShow";
import ContractCreate from "./pages/contract/ContractCreate";
import {Notifications} from "@mantine/notifications";
import {Authenticated} from "./components/forkedFromRefine/Authenticated";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import '@mantine/core/styles.css';
import {Layout} from "./components/layout";

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
                    <Notifications position="bottom-right"/>
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
                                },
                            },
                            {
                                name: "beneficiary",
                                list: "beneficiary/",
                                show: "beneficiary/:id",
                                meta: {
                                    label: "Bénéficiaires",
                                },
                            },
                            {
                                name: "vehicle",
                                list: "vehicle/",
                                show: "vehicle/:id",
                                meta: {
                                    label: "Véhicules",
                                },
                            },
                            {
                                name: "contract",
                                list: "contract/",
                                show: "contract/:id",
                                create: "contract/create",
                                meta: {
                                    label: "Contrats",
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
                                                if(error.statusCode === 401) {
                                                    return failureCount < 1
                                                }else {
                                                    return failureCount < 3
                                                }
                                            }
                                        }
                                    } } }
                        }}

                    >
                        <Routes>
                            <Route
                                element={
                                    <Authenticated
                                        key="authenticated-inner"
                                        // fallback={<CatchAllNavigate to="/login" />}
                                    >
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
                                    </Authenticated>
                                }
                            >
                                <Route
                                    index
                                    // element={<Dashboard/>}
                                    element={<Title>Dashboard</Title>}
                                />
                                {/*<Route path="/beneficiary">*/}
                                {/*    <Route index element={<BeneficiaryList />} />*/}
                                {/*    <Route path=":id" element={<BeneficiaryShow />} />*/}
                                {/*</Route>*/}
                                {/*<Route path="/vehicle">*/}
                                {/*    <Route index element={<VehicleList />} />*/}
                                {/*    <Route path=":id" element={<VehicleShow />} />*/}
                                {/*</Route>*/}
                                {/*<Route path="/contract">*/}
                                {/*    <Route index element={<ContractList />} />*/}
                                {/*    <Route path=":id" element={<ContractShow />} />*/}
                                {/*    <Route path="create" element={<ContractCreate />} />*/}
                                {/*</Route>*/}
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

                        {/*<UnsavedChangesNotifier />*/}
                        {/*<DocumentTitleHandler />*/}
                    </Refine>
                </ModalsProvider>
            </MantineProvider>
        </BrowserRouter>
    );
}

export default App;
