import { components } from "./schema";

type MileageEntry = components["schemas"]["MileageEntry"];
type MileageSource = components["schemas"]["SourceEnum"];
type MileageCorrectionPayload = { entry: number; value: number; reason: string };
