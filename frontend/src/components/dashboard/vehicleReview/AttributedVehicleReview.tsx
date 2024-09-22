import {useMemo} from "react";
import SearchableDataTable, {SearchableDataTableColumn} from "../../SearchableDataTable";
import {CompleteContract} from "../../../types/contract";
import {Beneficiary} from "../../../types/beneficiary";
import BeneficiaryBadge from "../../beneficiary/BeneficiaryBadge";
import {Vehicle} from "../../../types/vehicle";
import VehicleBadge from "../../Vehicle/VehicleBadge";
import {humanizeDate, humanizeFirstName} from "../../../constants";
import ContractDateFilter from "../../contract/filters/ContractDateFilter";
import {List} from "@refinedev/mantine";
import ContractSearchTooltip from "../../contract/ContractSearchTooltip";
import {ContractStatusEnum} from "../../../types/schema.d";
import ReferentGroup from "./ReferentGroup";
import {alpha} from "@mantine/core";

const AttributedVehicleReview = ({referentGroups}: {referentGroups: ReferentGroup[]}) => {

     const columns = useMemo<SearchableDataTableColumn<CompleteContract>[]>(
        () => [
            {
                accessor: 'vehicle',
                title: 'Véhicule',
                sortable: true,
                render: (contract) => {
                    const vehicle = contract.vehicle as Vehicle
                    return vehicle.hasOwnProperty("id") ? <VehicleBadge vehicle={vehicle} noLink/> : "Loading..."
                }

            },
            {
                accessor: 'beneficiary',
                title: 'Bénéficiaire',
                sortable: true,
                render: (contract) => {
                    const beneficiary = contract.beneficiary as Beneficiary
                    return beneficiary.hasOwnProperty("id") ? <BeneficiaryBadge beneficiary={beneficiary} noLink/> : "Loading..."
                }
            },
            {
                accessor: 'end_date',
                title: 'Fin',
                sortable: true,
                render: (contract) => (humanizeDate(contract.end_date)),
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`,
                filter: ContractDateFilter,
            },
            {
                accessor: 'referent',
                title: 'Référent',
                sortable: true,
                render: (contract) => {
                    return contract.referent?.hasOwnProperty("id") ? humanizeFirstName(contract.referent.first_name)+" "+contract.referent.last_name?.substring(0,1).toUpperCase()+"."  : "---"
                },
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },

        ],
        [],
    );

     const rowBackgroundColor = (contract: CompleteContract) => {

        const referent = contract.referent;
        const group = referentGroups.find((group) => group.referents.some((ref) => ref.id === referent.id));


        return group ? alpha(group.color, 0.3) : undefined;
     }

    return (
        <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <SearchableDataTable
                    searchPlaceHolder={"Rechercher un contract"}
                    columns={columns}
                    resource="contract"
                    permanentFilters={[{field:"status", operator:"in", value: [ContractStatusEnum.pending, ContractStatusEnum.waiting]}]}

                    withReloadIcon
                    withArchivedSwitch={false}
                    /*@ts-ignore*/
                    verticalSpacing="md"
                    striped={false}
                    // onRowClick={rowClickHandler}
                    // onCellClick={cellClickHandler}
                    searchInfoTooltip={ContractSearchTooltip}
                    rowBackgroundColor={rowBackgroundColor}
                />
            </List>
    );

}

export default AttributedVehicleReview;
