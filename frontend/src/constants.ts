import {ContractStatusEnum, ReasonEnum, VehicleStatusEnum} from "./types/schema.d";


export const ACCESS_TOKEN_KEY = 'auth_access';
export const REFRESH_TOKEN_KEY = 'auth_refresh';

export const API_URL = process.env["BASE_URL"] ?  process.env["BASE_URL"]+"/api" : '';

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



export const StatusConsideredOngoing = [ContractStatusEnum.pending,ContractStatusEnum.over,ContractStatusEnum.waiting];


export function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function humanizeDate(date: string) {
    return new Date(date).toLocaleDateString('fr-FR');
}

export function humanizeNumber(number: number) {
    return number.toLocaleString('fr-FR');
}