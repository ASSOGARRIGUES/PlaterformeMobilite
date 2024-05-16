import {components} from "./schema";

type Vehicle = components['schemas']['Vehicle'];

type VehicleWritableFields = Omit<Vehicle, "id" | "status" | "parking" | "created_at">

type VehicleTransformedFields = VehicleWritableFields & {photo: string | undefined}

type Parking = components['schemas']['Parking'];