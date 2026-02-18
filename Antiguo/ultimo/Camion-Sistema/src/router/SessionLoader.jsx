// src/components/SessionLoader.jsx
import React from "react";
import "../styles/SessionLoader.css";

export default function SessionLoader({ message = "Verificando sesión…" }) {
    return (
        <div className="session-loader" role="status" aria-live="polite">
            <div className="session-card">
                {/* Si tienes un logo, descomenta y apunta al path correcto */}
                {/* <img src="/logo.svg" alt="Logo" className="session-logo" /> */}

                <div className="session-spinner" aria-hidden="true" />

                <h1 className="session-title">{message}</h1>
                <p className="session-subtitle">Esto tomará solo unos segundos</p>

                <div className="session-progress" aria-hidden="true">
                    <div className="session-progress-bar" />
                </div>
            </div>
        </div>
    );
}
