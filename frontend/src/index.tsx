import "./instrument";

import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";

import App from "./App";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

dayjs.extend(customParseFormat);

root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
