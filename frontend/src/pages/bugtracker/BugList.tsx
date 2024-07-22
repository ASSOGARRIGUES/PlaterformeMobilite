import {useMemo} from "react";
import {DataTableColumn} from "mantine-datatable";
import EditButton from "../../components/EditButton";
import {Bug} from "../../types/bugtracker";
import {humanizeDate, humanizeFirstName} from "../../constants";
import BeneficiarySearchTooltip from "../../components/beneficiary/BeneficiarySearchTooltip";
import SearchableDataTable from "../../components/SearchableDataTable";

const BugList = () => {

    const columns = useMemo<DataTableColumn<Bug>[]>(
        () => [
            {
                accessor: 'id', //access nested data with dot notation
                title: '#',
                sortable: true,
            },
            {
                accessor: 'type',
                title: 'Type',
                sortable: true,
            },
            {
                accessor: 'description',
                title: 'Description',
                ellipsis: true,
                width: 300,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'reporter',
                title: 'Rapporteur',
                sortable: true,
                render: (bug) => {
                    return bug.reporter?.hasOwnProperty("id") ? humanizeFirstName(bug.reporter.first_name)+" "+bug.reporter.last_name?.substring(0,1).toUpperCase()+"."  : "---"
                }
            },
            {
                accessor: "targeted_version",
                title: "Version",
                sortable: true,
            },
            {
                accessor: 'severity',
                title: 'Sévérité',
                sortable: true,
            },
            {
                accessor: 'date',
                title: 'Date',
                sortable: true,
                render: (bug) => (humanizeDate(bug.created_at)),
            },
            {
                accessor: 'status',
                title: 'Status',
                sortable: true,
            },
            {
                accessor: "resolve_version",
                title: "V° resolve",
                sortable: true,
            }
        ],
        [],
    );

    return (
        <SearchableDataTable
            withoutSearch
            withArchivedSwitch={false}
            defaultSortedColumn="status"
            defaultSortedDirection="desc"
            columns={columns}
            resource="bugtracker/bug"

            withReloadIcon
            /*@ts-ignore*/
            verticalSpacing="md"
            // onRowClick={rowClickHandler}
            // searchInfoTooltip={BeneficiarySearchTooltip}
        />
    );
}

export default BugList;
