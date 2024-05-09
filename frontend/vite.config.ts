import react from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";


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
    define: {
      'process.env': processEnv,
    },
    plugins: [react()],
  }
});
