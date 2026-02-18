// Ubicación: src/components/LoadingSpinner.jsx

import React from 'react';

// Este componente acepta un 'message' opcional para personalizar el texto.
// Si no se le pasa ningún mensaje, usará "Cargando..." por defecto.
const LoadingSpinner = ({ message = 'Cargando...' }) => {
    return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>{message}</p>
        </div>
    );
};

export default LoadingSpinner;