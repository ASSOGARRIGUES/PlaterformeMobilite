import {components} from "./schema";

type Vehicle = components['schemas']['Vehicle'];

type VehicleWritableFields = Omit<Vehicle, "id">