import { components } from "./schema";

type MileageEntry = components["schemas"]["MileageEntry"];
type MileageSource = components["schemas"]["SourceEnum"];
type MileageCorrectionPayload = { entry: number; value: number; reason: string };

type LocalTaskPart = { localId: string; name: string; unitPrice: number; quantity: number };
type LocalTask = {
    localId: string;
    catalogTaskId?: number;      // undefined = tâche libre
    name: string;                 // dénormalisé depuis le catalogue, ou saisi libre
    type: "done" | "planned";
    periodicityLabel?: string;    // ex: "15 000 km / 1 an", purement informatif (chip)
    isWearTask: boolean;          // dénormalisé depuis TaskCatalog.is_wear_task ; false pour une tâche libre
    wearLevel?: number;           // 0-10, affiché seulement quand isWearTask est vrai
    description?: string;
    parts: LocalTaskPart[];
    photos: string[];             // URLs serveur (existantes) ou base64 data URLs (nouvelles)
    serverId?: number;            // id côté serveur dès que POST .../tasks/ a réussi (story 2.6)
    photoIds?: (number | null)[]; // aligné sur photos ; id GaragePhoto si URL serveur, null si base64 pas encore uploadé
    sheetId?: number;             // fiche source (story 2.7), pour lier vers la fiche depuis PlannedTasksPanel
};

// ── Fiches d'intervention (story 2.6) ────────────────────────────────────────
type InterventionSheet = components["schemas"]["InterventionSheet"];
type InterventionTask = components["schemas"]["InterventionTask"];
type InterventionTaskPart = components["schemas"]["InterventionTaskPart"];

// Types de payload manuels : le schéma OpenAPI est incomplet sur les actions custom
// de InterventionSheetViewSet (cf. Dev Notes 2.6 "Schéma OpenAPI incomplet")
type CreateInterventionPayload = { vehicle: number };
type PatchInterventionPayload = Partial<{
    start_mileage: number; current_step: number; start_date: string; end_date: string;
}>;
type CreateInterventionTaskPayload = {
    type: "done" | "planned";
    catalog_task?: number;
    name?: string;
    description?: string;
    wear_level?: number;
};
type UpdateInterventionTaskPayload = Partial<{
    name: string;
    description: string;
    wear_level: number | null;
    parts: { name: string; unit_price: number; quantity: number }[];
    add_photos: string[];
    remove_photo_ids: number[];
}>;

// ── Traçabilité fiches validées (story 2.7) ──────────────────────────────────
type AuditLogEntry = {
    id: number;
    author_display: string;
    created_at: string;
    action: string;
    field_name: string;
    old_value: string;
    new_value: string;
};
