import {Beneficiary} from "../../types/beneficiary";
import {useMemo} from "react";
import {List} from "@refinedev/mantine";
import SearchableDataTable, {SearchableDataTableColumn} from "../../components/SearchableDataTable";
import BeneficiaryModal from "../../components/beneficiary/BeneficiaryModal";
import {useGetToPath, useGo} from "@refinedev/core";
import useBeneficiaryModalForm from "../../hooks/beneficiary/useBeneficiaryModalForm";
import BeneficiarySearchTooltip from "../../components/beneficiary/BeneficiarySearchTooltip";
import {DataTableRowClickHandler} from "mantine-datatable";
import EditButton from "../../components/EditButton";


function BeneficiaryList() {

    const go = useGo();
    const getToPath = useGetToPath();


    const createModalForm = useBeneficiaryModalForm({action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    const editModalForm = useBeneficiaryModalForm({action: "edit"});
    const {modal: { show: showEditModal },  } = editModalForm;

    const columns = useMemo<SearchableDataTableColumn<Beneficiary>[]>(
        () => [
            {
                accessor: 'first_name', //access nested data with dot notation
                title: 'Prénom',
                sortable: true,
            },
            {
                accessor: 'last_name',
                title: 'Nom',
                sortable: true,
            },
            {
                accessor: 'address', //normal accessorKey
                title: 'Addresse',
                sortable: true,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: 'city',
                title: 'Ville',
                sortable: true,
                visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`
            },
            {
                accessor: "actions",
                title:"Actions",
                textAlignment:"center",
                render: (beneficiary) => (<EditButton record={beneficiary} showEditModal={showEditModal}/>),
            }
        ],
        [],
    );

    const rowClickHandler: DataTableRowClickHandler<Beneficiary> = ({record : beneficiary, index, event}) => {
        const path = getToPath({
            action: "show",
            meta: {
                id: beneficiary.id
            }
        });

        go({
            to: path
        });
    }

    return (
        <>
            <BeneficiaryModal {...createModalForm}/>
            <BeneficiaryModal {...editModalForm}/>

            <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column", paddingBottom:2}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <SearchableDataTable
                    searchPlaceHolder={"Rechercher un beneficiaire"}
                    columns={columns}

                    withAddIcon={true}
                    addCallback={() => {showCreateModal()}}
                    withReloadIcon
                    /*@ts-ignore*/
                    verticalSpacing="md"
                    onRowClick={rowClickHandler}
                    searchInfoTooltip={BeneficiarySearchTooltip}
                />
            </List>
        </>
    )
}

export default BeneficiaryList;
