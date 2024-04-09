import {components, operations} from "./schema";

type Beneficiary = components['schemas']['Beneficiary'];

type BeneficiaryWritableFields = Omit<Beneficiary, "id">