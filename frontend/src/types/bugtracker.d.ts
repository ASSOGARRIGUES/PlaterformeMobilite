import {components, operations} from "./schema";

export type Bug = components['schemas']['Bug'];

export type BugWritableFields = Omit<Bug, "id" | "date" | "created_at" | "reporter">;

