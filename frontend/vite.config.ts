import react from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";


const envAvailableKeys = [
    'BASE_URL',
    'VERSION',
    ];

type processEnvKeys = typeof envAvailableKeys[number];

type processEnvType = {
  [key in processEnvKeys]: any;
};

export default defineConfig(({mode})=>{
  const env = loadEnv(mode, process.cwd(), '');
  const processEnv = {} as processEnvType;
  envAvailableKeys.forEach(key => processEnv[key as processEnvKeys] = env[key]);

  return {
    build: {
      sourcemap: "hidden",
    },
    define: {
      'process.env': processEnv,
    },
    plugins: [
      react(),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
    ],
  }
});
