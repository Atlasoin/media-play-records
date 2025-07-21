import React from "react";
import { createRoot } from "react-dom/client";
import History from "../components/History";

// Get root element
const container = document.getElementById("root");
if (!container) {
    throw new Error("Root element not found");
}

const root = createRoot(container);

// Render History component
root.render(
    <React.StrictMode>
        <History
            onBack={() => {
                // Go back to previous page or close tab
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.close();
                }
            }}
        />
    </React.StrictMode>
);
