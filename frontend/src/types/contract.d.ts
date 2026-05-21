import {components, ReasonEnum} from "./schema";
import {Vehicle} from "./vehicle";
import {Beneficiary} from "./beneficiary";
import {User} from "./auth";

type Contract = components['schemas']['Contract'];

type CreateContractValues = Omit<Contract, "id">;

type CompleteContract = Contract

type ContractWritableFields = Omit<components['schemas']['MutationContract'], "id" | "created_by" | "created_at" | "end_kilometer" | "status" | "action" | "renewed_from_id" | "active_renewal_id" | "root_contract_id" | "root_contract_created_at" | "root_contract_deposit" | "root_contract_deposit_payment_mode" | "root_contract_deposit_check_number" | "has_active_renewal" | "renewed_from">

type EndContract = components["schemas"]["EndContract"]
type EndContractWritableFields = Omit<EndContract, "id" | "max_kilometer" | "start_kilometer" | "vehicle_kilometer">

type Payment = components["schemas"]["Payment"]
type ContractPaymentSummary = components["schemas"]["ContractPaymentSummary"]
type WritablePayment = Omit<components["schemas"]["PatchedPayment"], "id" | "created_at" | "created_by">



