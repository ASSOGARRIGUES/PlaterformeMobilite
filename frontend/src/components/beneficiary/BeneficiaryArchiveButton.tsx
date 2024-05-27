import {CompleteContract} from "../../types/contract";
import ArchiveButton from "../ArchiveButton";
import {Beneficiary} from "../../types/beneficiary";
import BeneficiaryBadge from "./BeneficiaryBadge";


const BeneficiaryArchiveButton = ({beneficiary}: {beneficiary: Beneficiary | undefined}) => {

    const modalContent = (
        <div>
            Vous êtes sur le point d'archiver le bénéficiaire <BeneficiaryBadge beneficiary={beneficiary} noLink/><br/>
            Cette action est <i><b>irréversible</b></i> et entrainera l'archivage de <u>l'ensemble</u> des contrats reliés.<br/>
            <p>Êtes-vous certain de vouloir continuer ?</p>
        </div>
    )

    return (
        <ArchiveButton id={beneficiary?.id} ressource={"beneficiary"} modalContent={modalContent} color="red" disabled={beneficiary?.archived}/>
    )
}

export default BeneficiaryArchiveButton;