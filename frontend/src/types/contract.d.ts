import {components, ReasonEnum} from "./schema";
import {Vehicle} from "./vehicle";
import {Beneficiary} from "./beneficiary";
import {User} from "./auth";

type Contract = components['schemas']['Contract'];

type CreateContractValues = Omit<Contract, "id">;

type CompleteContract = Contract | Omit<Contract, "vehicle" | "beneficiary" | "referent"> & {vehicle: Vehicle, beneficiary: Beneficiary, referent: User};

type ContractWritableFields = Omit<Contract, "id" | "created_by" | "created_at" | "end_kilometer" | "start_kilometer" | "status">

type EndContract = components["schemas"]["EndContract"]
type EndContractWritableFields = Omit<EndContract, "id" | "max_kilometer" | "start_kilometer">


