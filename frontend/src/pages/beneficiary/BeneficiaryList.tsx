import {Beneficiary} from "../../types/beneficiary";
import {useMemo, useState} from "react";
import {List, useModalForm} from "@refinedev/mantine";
import SearchableDataTable from "../../components/SearchableDataTable";
import {DataTableColumn} from "mantine-datatable/dist/types/DataTableColumn";
import BeneficiaryModal from "../../components/beneficiary/BeneficiaryModal";
import {ActionIcon, Center} from "@mantine/core";
import {IconEdit} from "@tabler/icons-react";
import {useGetToPath, useGo} from "@refinedev/core";
import useBeneficiaryModalForm from "../../hooks/beneficiary/useBeneficiaryModalForm";


function BeneficiaryList() {

    const go = useGo();
    const getToPath = useGetToPath();


    const createModalForm = useBeneficiaryModalForm({action: "create"});
    const {modal: { show: showCreateModal },  } = createModalForm;

    const editModalForm = useBeneficiaryModalForm({action: "edit"});
    const {modal: { show: showEditModal },  } = editModalForm;


    const EditButton = ({beneficiary}: {beneficiary: Beneficiary}) => {

        return (
            <Center>
                <ActionIcon onClick={(e)=>{e.stopPropagation();showEditModal(beneficiary.id)}}  color="blue">
                    <IconEdit size={25} />
                </ActionIcon>
            </Center>
        )
    }

    const columns = useMemo<DataTableColumn<Beneficiary>[]>(
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
            },
            {
                accessor: 'city',
                title: 'Ville',
                sortable: true,
            },
            {
                accessor: "actions",
                title:"Actions",
                textAlignment:"center",
                render: (beneficiary) => (<EditButton beneficiary={beneficiary}/>),
            }
        ],
        [],
    );

    const rowClickHandler = (beneficiary: Beneficiary, rowIndex: number) => {
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

            <List title="" wrapperProps={{children: undefined, style:{height:"100%", display:"flex", flexDirection:"column"}}} contentProps={{style:{flex:"auto", minHeight:0}}}>
                <SearchableDataTable
                    searchPlaceHolder={"Rechercher un beneficiaire"}
                    columns={columns}

                    withAddIcon={true}
                    addCallback={() => {showCreateModal()}}
                    withReloadIcon
                    /*@ts-ignore*/
                    verticalSpacing="md"
                    onRowClick={rowClickHandler}
                />
            </List>
        </>
    )
}

export default BeneficiaryList;
