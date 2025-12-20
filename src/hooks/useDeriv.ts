import { useContext } from "react";
import { DerivContext } from "../context/DerivContext";

export const useDeriv = () => {
    const context = useContext(DerivContext);
    if (context === undefined) {
        throw new Error("useDeriv must be used within a DerivProvider");
    }
    return context;
};
