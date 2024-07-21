import {
    BugSeverityEnum,
    BugTypeEnum,
    ContractStatusEnum,
    FuelTypeEnum,
    PaymentModeEnum,
    ReasonEnum,
    VehicleTypeEnum,
} from "./types/schema.d";
import {axiosInstance} from "./providers/rest-data-provider/utils";
import {DateInputProps} from "@mantine/dates";


export const ACCESS_TOKEN_KEY = 'auth_access';
export const REFRESH_TOKEN_KEY = 'auth_refresh';

export const API_URL = process.env["BASE_URL"] ?  process.env["BASE_URL"]+"/api" : '';

export const VERSION = process.env["VERSION"] || '0.0.0';

export const PAGE_SIZE = 10;

export const DEBOUNCE_TIME = 300;

export const APP_TITLE = 'Plateforme Mobilité';

export const contractReasonLabelMap: Record<string,string> = {
    [ReasonEnum.aided_contract]: "Contrat aidé",
    [ReasonEnum.cdd]: "CDD",
    [ReasonEnum.cdi]: "CDI",
    [ReasonEnum.interim]: "Intérim",
    [ReasonEnum.formation]: "Formation",
    [ReasonEnum.job_seeking]: "Recherche d'emploi",
    [ReasonEnum.part_time]: "Alternance",
}

export const vehicleTypeLabelMap: Record<string,string> = {
    [VehicleTypeEnum.voiture]: "Voiture",
    [VehicleTypeEnum.scouter]: "Scooter",
}

export const fuelTypeLabelMap: Record<string,string> = {
    [FuelTypeEnum.electrique]: "Electrique",
    [FuelTypeEnum.essence]: "Essence",
    [FuelTypeEnum.diesel]: "Diesel",
}

export const paymentModeLabelMap: Record<string,string> = {
    [PaymentModeEnum.cash]: "Espèces",
    [PaymentModeEnum.card]: "Carte bancaire",
    [PaymentModeEnum.check]: "Chèque",
}

export const bugTypeLabelMap: Record<string,string> = {
    [BugTypeEnum.bug]: "Bug",
    [BugTypeEnum.feature]: "Fonctionnalité",
    [BugTypeEnum.suggestion]: "Suggestion",
}

export const bugSeverityLabelMap: Record<string,string> = {
    [BugSeverityEnum.low]: "Pas pressé",
    [BugSeverityEnum.medium]: "Génant: Un peu génant mais peu d'influence sur mon travail",
    [BugSeverityEnum.high]: "Ralentissant: Ne me bloque pas mais me ralentit fortement",
    [BugSeverityEnum.critical]: "Bloquant: je suis bloqué(e) dans mon travail",
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

export function humanizeFirstName(name: string | undefined){
    if (!name) return '';
    return capitalizeFirstLetter(name.toLowerCase());
}

export function humanizeLastName(name: string | undefined){
    if (!name) return '';
    return name.toUpperCase();
}

export const downloadInBrowser = (
    content: string,
    type?: string,
) => {
    if (typeof window === "undefined") {
        return;
    }

    const blob = new Blob([content], { type });

    const link = document.createElement("a");
    link.setAttribute("visibility", "hidden");
    //link.download = filename;
    link.target = "_blank";
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // As per documentation, call URL.revokeObjectURL to remove the blob from memory.
    setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
    });
};

export const openPdfInNewTab = async (pdfUrl: string) => {
    try{
        const pdfData = await axiosInstance["get"](pdfUrl);

        downloadInBrowser(pdfData.data, "application/pdf");
    }catch (e){
        console.error(e);
    }
}


/**
 * Parse a date string in the fr format (DD/MM/YYYY) to a Date object
 * @param input
 */
const dateParser: DateInputProps['dateParser'] = (input) => {
    //pars the date in the format DD/MM/YYYY using dayjs
    return input ? new Date(input) : null;
}