// src/context/PermissionAlertProvider.js
import React, { createContext, useContext, useState, useCallback } from "react";
import CustomAlert from "../components/CustomAlert";

const PermissionAlertContext = createContext();
let externalShowAlert = null; // 🔹 external reference

export const PermissionAlertProvider = ({ children }) => {
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: "",
        message: "",
        actions: [],
        type: "info",
    });

    const showAlert = useCallback((config) => {
        setAlertConfig({ visible: true, ...config });
    }, []);

    const hideAlert = useCallback(() => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
    }, []);

    // expose global method for non-React files
    externalShowAlert = showAlert;

    return (
        <PermissionAlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <CustomAlert
                visible={alertConfig.visible}
                onDismiss={hideAlert}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                actions={alertConfig.actions.map((a) => ({
                    ...a,
                    onPress: () => {
                        hideAlert();   // always close alert
                        a.onPress?.(); // call original action
                    },
                }))}
            />

        </PermissionAlertContext.Provider>
    );
};

export const usePermissionAlert = () => useContext(PermissionAlertContext);

// 🔹 Export global function for utils (like permissions.js)
export const showPermissionAlert = (config) => {
    if (externalShowAlert) {
        externalShowAlert(config);
    } else {
        console.warn("PermissionAlertProvider not mounted yet.");
    }
};
