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
    photos: string[];             // base64 data URLs
};
