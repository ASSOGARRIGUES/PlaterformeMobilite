import {CompleteContract} from "../../types/contract";
import ArchiveButton from "../ArchiveButton";


const ContractArchiveButton = ({contract}: {contract: CompleteContract | undefined}) => {

    const modalContent = (
        <div>
            Vous êtes sur le point d'archiver le contrat #{contract?.id}<br/>
            Cette action est <i><b>irréversible</b></i>.<br/>
            <p>Êtes-vous certain de vouloir continuer ?</p>
        </div>
    )

    return (
        <ArchiveButton id={contract?.id} ressource={"contract"} modalContent={modalContent} color="red" disabled={contract?.archived}/>
    )
}

export default ContractArchiveButton;