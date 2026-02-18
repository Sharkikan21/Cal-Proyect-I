// Ubicación: src/pages/recepcion-cal/RecepcionCalPage.jsx

import React from 'react';
import { ProcesoCamionProvider, useProcesoCamion } from '../../context/ProcesoCamionContext';
import CamionList from './components/CamionList';
import RecepcionCal from './RecepcionCal';
import '../../styles/recepcion-cal.css';

function RecepcionCalView() {
    const { camionActual } = useProcesoCamion();
    if (camionActual) {
        return <RecepcionCal />;
    }
    return <CamionList />;
}

// Componente principal que exportamos
export default function RecepcionCalPage() {
    return (
        <ProcesoCamionProvider>
            <div className="main-content" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
                <RecepcionCalView />
            </div>
        </ProcesoCamionProvider>
    );
} 