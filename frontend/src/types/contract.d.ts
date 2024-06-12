import {components, ReasonEnum} from "./schema";
import {Vehicle} from "./vehicle";
import {Beneficiary} from "./beneficiary";
import {User} from "./auth";

type Contract = components['schemas']['Contract'];

type CreateContractValues = Omit<Contract, "id">;

type CompleteContract = Contract

type ContractWritableFields = Omit<components['schemas']['MutationContract'], "id" | "created_by" | "created_at" | "end_kilometer" | "status">

type EndContract = components["schemas"]["EndContract"]
type EndContractWritableFields = Omit<EndContract, "id" | "max_kilometer" | "start_kilometer">

type Payment = components["schemas"]["Payment"]
type ContractPaymentSummary = components["schemas"]["ContractPaymentSummary"]
type WritablePayment = Omit<components["schemas"]["PatchedPayment"], "id" | "created_at" | "created_by">



