import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import {CompleteContract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import VehicleBadge from "../Vehicle/VehicleBadge";
import {Beneficiary} from "../../types/beneficiary";
import BeneficiaryBadge from "../beneficiary/BeneficiaryBadge";
import ContractStatusBadge from "../contract/ContractStatusBadge";
import ContractTable from "../contract/ContractTable";
import {WhoAmI} from "../../types/auth";
import {CrudFilter} from "@refinedev/core";
import {ContractStatusEnum} from "../../types/schema.d";

const LateReturnTable = ({onlyForUser}: {onlyForUser?: WhoAmI} ) => {

    const todayDate = useMemo(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }, []);


    const columns = useMemo<DataTableColumn<CompleteContract>[]>(
        () => [
            {
                accessor: 'vehicle', //access nested data with dot notation
                title: 'Véhicule',
                sortable: true,
                render: (contract) => {
                    const vehicle = contract.vehicle as Vehicle
                    return vehicle.hasOwnProperty("id") ? <VehicleBadge vehicle={vehicle}/> : "Loading..."
                }

            },
            {
                accessor: 'beneficiary',
                title: 'Bénéficiaire',
                sortable: true,
                render: (contract) => {
                    const beneficiary = contract.beneficiary as Beneficiary
                    return beneficiary.hasOwnProperty("id") ? <BeneficiaryBadge beneficiary={beneficiary}/> : "Loading..."
                }
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
            },
            {
                accessor: 'late_days',
                title: 'Nb jours',
                sortable: true,
                render: (contract) => {
                    // Diff between end_date and today
                    const end = new Date(contract.end_date);
                    const today = new Date();
                    const diffTime = Math.abs(today.getTime() - end.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return (diffDays + " jours");
                }
            },
            {
                accessor: "status",
                title:"Status",
                textAlignment:"center",
                sortable: true,
                render: (contract) => (<ContractStatusBadge contract={contract}/>),
            },
        ],
        [],
    );



    const userFilter = useMemo(() => {
        return onlyForUser ? [{field: "referent", operator: "eq", value: onlyForUser.id} as CrudFilter] : [];
    },[onlyForUser]);


    return (
        <ContractTable
            searchPlaceHolder={"Rechercher un contrat"}
            columns={columns}
            withoutSearch
            /*@ts-ignore*/
            verticalSpacing="md"
            noRecordsText="Aucun contrat en retard"
            permanentFilters={[{field: "end_date", operator: "lt", value: todayDate}, {field: "status", operator: "eq", value: ContractStatusEnum.pending}, ...userFilter]}
            pageSize={4}
            syncWithLocation={false}
        />
    );
}

export default LateReturnTable;