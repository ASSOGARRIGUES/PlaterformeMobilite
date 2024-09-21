import {components} from "./schema";

type Vehicle = components['schemas']['Vehicle'];

type ShortVehicle = components['schemas']['ShortVehicle'];

type VehicleWritableFields = Omit<Vehicle, "id" | "status" | "parking" | "created_at" | "action">

type VehicleTransformedFields = VehicleWritableFields & {photo: string | undefined}

type Parking = components['schemas']['Parking'];

type VehicleActionTransfer = components['schemas']['VehicleActionTransfer']