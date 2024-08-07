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
import {ContractStatusEnum} from "../../types/schema.d";
import {humanizeDate, StatusConsideredOngoing} from "../../constants";
import {DataTableColumn} from "mantine-datatable";

const OnGoingContractTable = ({onlyForUser}: {onlyForUser?: WhoAmI} ) => {

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
                accessor: 'start_date', //normal accessorKey
                title: 'Début',
                sortable: true,
                render: (contract) => (humanizeDate(contract.start_date)),
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
                render: (contract) => (humanizeDate(contract.end_date)),
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

            /*@ts-ignore*/
            verticalSpacing="md"
            noRecordsText="Vous n'êtes référent d'aucun contrat en cours"
            permanentFilters={[{field: "status", operator: "in", value: StatusConsideredOngoing}, ...userFilter]}
            pageSize={6}
            syncWithLocation={false}
            defaultSortedColumn="start_date"
            defaultSortedDirection="desc"
        />
    );
}

export default OnGoingContractTable;