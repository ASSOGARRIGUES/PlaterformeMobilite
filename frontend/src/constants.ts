import {ReasonEnum} from "./types/schema.d";


export const ACCESS_TOKEN_KEY = 'auth_access';
export const REFRESH_TOKEN_KEY = 'auth_refresh';

export const API_URL = process.env["BASE_URL"] ?  process.env["BASE_URL"]+"/api" : '';
console.log("BASE_URL", process.env["BASE_URL"]);
console.log("URL", process.env["BASE_URL"]+"/api")
console.log("API_URL", API_URL);
export const PAGE_SIZE = 10;

export const DEBOUNCE_TIME = 300;

export const APP_TITLE = 'Platforme Mobilité';

export const contractReasonLabelMap: Record<string,string> = {
    [ReasonEnum.aided_contract]: "Contrat aidé",
    [ReasonEnum.cdd]: "CDD",
    [ReasonEnum.cdi]: "CDI",
    [ReasonEnum.interim]: "Intérim",
    [ReasonEnum.formation]: "Formation",
    [ReasonEnum.job_seeking]: "Recherche d'emploi",
    [ReasonEnum.part_time]: "Alternance",
}