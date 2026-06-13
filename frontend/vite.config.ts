import react from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { VitePWA } from 'vite-plugin-pwa';


const envAvailableKeys = [
    'BASE_URL',
    'VERSION',
    'VITE_SENTRY_DSN',
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
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.png'],
        manifest: {
          name: 'Plateforme Mobilité',
          short_name: 'Mobilité',
          description: 'Gestion de flotte véhicules — module garage',
          theme_color: '#0c8599',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/favicon.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/favicon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/offline.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [],
        },
      }),
      sentryVitePlugin({
        org: "simtech-gl",
        project: "garrigues_mobilite",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      }),
    ],
  }
});
