import * as Sentry from "@sentry/react";
import React from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

Sentry.init({
  dsn: process.env["VITE_SENTRY_DSN"],
  environment: import.meta.env.MODE,
  release: process.env["VERSION"] || "0.0.0-dev",
  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],

  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    "localhost",
    ...(process.env["BASE_URL"] ? [process.env["BASE_URL"]] : []),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  tunnel: `${process.env["BASE_URL"] || ""}/sentry-tunnel/`,
});
