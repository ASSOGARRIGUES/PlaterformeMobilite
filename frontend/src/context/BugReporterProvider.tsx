import {createContext, ReactNode, useContext, useState} from "react";
import BugReporterModal from "../components/bugreporter/BugReporterModal";
import logSaver from "../logSaver";

export type BugReporterContextType = {
    isBugModalOpen: boolean;
    setBugModalOpen: (isOpen: boolean) => void;
    openBugModal: () => void;
}

const BugReporterContext = createContext<BugReporterContextType | null>(null);

const useBugReporter = () => {
    const context = useContext(BugReporterContext) as BugReporterContextType;

    if(!context) {
        throw new Error("useBugReporter must be used within a BugReporterProvider");
    }

    return context;
}

const BugReporterProvider = ({children} : {children: ReactNode}) => {
    const [isBugModalOpen, setBugModalOpen] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);


    const openBugModal = () => {
        setBugModalOpen(true);
    }

    return (
        <BugReporterContext.Provider value={{isBugModalOpen, setBugModalOpen, openBugModal}}>
            {children}
            <BugReporterModal isBugModalOpen={isBugModalOpen} setBugModalOpen={setBugModalOpen}/>
        </BugReporterContext.Provider>
    )
}

export {BugReporterProvider, useBugReporter, BugReporterContext}