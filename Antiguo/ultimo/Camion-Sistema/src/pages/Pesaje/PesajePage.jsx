// Ubicación: src/pages/Pesaje/PesajePage.jsx

import React from 'react';
import { ProcesoCamionProvider, useProcesoCamion } from '../../context/ProcesoCamionContext';
import CamionList from './components/CamionList';
import ProcesoCamion from './ProcesoCamion'; // <-- Importamos el director de orquesta

// Componente interno que cambia la vista según el estado del contexto
function PesajeView() {
    const { camionActual } = useProcesoCamion();

    // Si hay un camión seleccionado en el contexto, muestra el proceso.
    if (camionActual) {
        return <ProcesoCamion />;
    }

    // Si no, muestra la lista para seleccionar uno.
    return <CamionList />;
}

// Componente principal que exportamos
export default function PesajePage() {
    return (
        // Envolvemos todo en el Provider para que los componentes hijos
        // (CamionList y ProcesoCamion) puedan compartir el estado.
        <ProcesoCamionProvider>
            <div className="main-content" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
                <PesajeView />
            </div>
        </ProcesoCamionProvider>
    );
}