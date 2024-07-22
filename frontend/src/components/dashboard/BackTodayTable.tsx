import SearchableDataTable from "../SearchableDataTable";
import {useMemo} from "react";
import {CompleteContract} from "../../types/contract";
import {Vehicle} from "../../types/vehicle";
import VehicleBadge from "../Vehicle/VehicleBadge";
import {Beneficiary} from "../../types/beneficiary";
import BeneficiaryBadge from "../beneficiary/BeneficiaryBadge";
import ContractStatusBadge from "../contract/ContractStatusBadge";
import ContractTable from "../contract/ContractTable";
import {WhoAmI} from "../../types/auth";
import {CrudFilter} from "@refinedev/core";
import {DataTableColumn} from "mantine-datatable";

const BackTodayTable = ({onlyForUser}: {onlyForUser?: WhoAmI} ) => {
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
                accessor: "status",
                title:"Status",
                textAlignment:"center",
                sortable: true,
                render: (contract) => (<ContractStatusBadge contract={contract}/>),
            },
        ],
        [],
    );

    const todayDate = useMemo(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }, []);

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
            noRecordsText="Aucun retour aujourd'hui"
            permanentFilters={[{field: "end_date", operator: "lte", value: todayDate}, {field: "end_date", operator: "gte", value: todayDate}, ...userFilter]}
            pageSize={3}
            syncWithLocation={false}
        />
    );
}

export default BackTodayTable;