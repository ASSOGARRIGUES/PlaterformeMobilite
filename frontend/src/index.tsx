import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

dayjs.extend(customParseFormat);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
