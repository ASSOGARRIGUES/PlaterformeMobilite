import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import {
    ErrorComponent,
    RefineThemes,
    AuthPage,
    useNotificationProvider, ThemedTitleV2
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
import {MantineProvider} from "@mantine/core";
import { NotificationsProvider } from "@mantine/notifications";
import { MantineInferencer } from "@refinedev/inferencer/mantine";
import {ThemedLayoutV2} from "./components/layout";
import VehicleList from "./pages/vehicle/VehicleList";
import ContractList from "./pages/contract/ContractList";
import BeneficiaryShow from "./pages/beneficiary/BeneficiaryShow";
import VehicleShow from "./pages/vehicle/VehicleShow";
import { ModalsProvider } from "@mantine/modals";

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



    return (
        <BrowserRouter>
            <MantineProvider
                theme={RefineThemes.Blue}
                withNormalizeCSS
                withGlobalStyles
            >
                <ModalsProvider>
                    <NotificationsProvider position="bottom-right">
                        <Refine
                            dataProvider={dataProvider(API_URL)}
                            routerProvider={routerBindings}
                            authProvider={authProvider}
                            notificationProvider={useNotificationProvider}
                            resources={[
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
                                            fallback={<CatchAllNavigate to="/login" />}
                                        >
                                            <ThemedLayoutV2 Title={({ collapsed }) => (
                                                <ThemedTitleV2
                                                    // collapsed is a boolean value that indicates whether the <Sidebar> is collapsed or not
                                                    collapsed={collapsed}

                                                    text={APP_TITLE}
                                                />
                                            )}>
                                                <Outlet />
                                            </ThemedLayoutV2>
                                        </Authenticated>
                                    }
                                >
                                    <Route
                                        index
                                        element={<NavigateToResource resource="blog_posts" />}
                                    />
                                    <Route path="/beneficiary">
                                        <Route index element={<BeneficiaryList />} />
                                        <Route path=":id" element={<BeneficiaryShow />} />
                                    </Route>
                                    <Route path="/vehicle">
                                        <Route index element={<VehicleList />} />
                                        <Route path=":id" element={<VehicleShow />} />
                                    </Route>
                                    <Route path="/contract">
                                        <Route index element={<ContractList />} />
                                    </Route>
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

                            <UnsavedChangesNotifier />
                            <DocumentTitleHandler />
                        </Refine>
                    </NotificationsProvider>
                </ModalsProvider>
            </MantineProvider>
        </BrowserRouter>
    );
}

export default App;
