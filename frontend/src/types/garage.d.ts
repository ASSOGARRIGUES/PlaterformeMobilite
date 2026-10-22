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
    periodicityLabel?: string;    // ex: "Tous les 15 000 km ou 1 an", purement informatif (chip)
    icon?: string;                // dénormalisé depuis TaskCatalog.icon ; absent pour une tâche libre (IconTool par défaut)
    isWearTask: boolean;          // dénormalisé depuis TaskCatalog.is_wear_task ; false pour une tâche libre
    wearLevel?: number;           // 0-10, affiché seulement quand isWearTask est vrai
    description?: string;
    parts: LocalTaskPart[];
    photos: string[];             // URLs serveur (existantes) ou base64 data URLs (nouvelles)
    serverId?: number;            // id côté serveur dès que POST .../tasks/ a réussi (story 2.6)
    photoIds?: (number | null)[]; // aligné sur photos ; id GaragePhoto si URL serveur, null si base64 pas encore uploadé
    sheetId?: number;             // fiche source (story 2.7)
    sourceSignalementId?: number; // signalement dont la tâche est issue (« + » des suggestions) ; le signalement n'est plus suggéré tant que la tâche existe
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

// ── Synchronisation kilométrage véhicule (story 2.9) ─────────────────────────
// Le schéma OpenAPI ne reflète pas la clé "warnings" ajoutée à la réponse
// custom de InterventionSheetViewSet.validate() (cf. Dev Notes 2.9).
type InterventionValidateWarning = {
    code: string;
    message: string;
    more_recent_entry: { value: number; date: string };
};
type ValidateInterventionResponse = InterventionSheet & { warnings: InterventionValidateWarning[] };

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

// ── Synthèse d'entretien (story 2.11) ────────────────────────────────────────
type MaintenanceSummary = components["schemas"]["MaintenanceSummary"];
type MaintenanceTask = components["schemas"]["MaintenanceTask"];
type MaintenanceSignalement = components["schemas"]["MaintenanceSignalement"];
type MaintenanceOtherWork = components["schemas"]["MaintenanceOtherWork"];
type MaintenanceSheet = components["schemas"]["MaintenanceSheet"];
type MaintenanceCounts = components["schemas"]["MaintenanceCounts"];

// ── Fiches de contrôle (story 3.2) ───────────────────────────────────────────
type InspectionSheet = components["schemas"]["InspectionSheet"];
type InspectionWearMeasurement = components["schemas"]["InspectionWearMeasurement"];
type InspectionDamage = components["schemas"]["InspectionDamage"];
type InspectionTask = components["schemas"]["InspectionTask"];
type MeasurableTask = components["schemas"]["MeasurableTask"];
type GarageConfig = components["schemas"]["MaintenanceConfig"];
type PatchInspectionPayload = components["schemas"]["PatchedMutationInspectionSheet"];
// Le schéma OpenAPI ne reflète pas la clé "warnings" de InspectionSheetViewSet.validate()
type ValidateInspectionResponse = InspectionSheet & { warnings: InterventionValidateWarning[] };

// Dégât saisi à l'étape 5 : carte locale, écrite sur le serveur au passage d'étape (POST puis PATCH|DELETE)
type LocalDamage = {
    localId: string;
    serverId?: number;
    description: string;
    photos: string[];             // URLs serveur ou data URLs base64 (nouvelles)
    photoIds?: (number | null)[]; // aligné sur photos
};
