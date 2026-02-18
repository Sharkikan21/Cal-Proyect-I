// Ubicación: src/pages/Pesaje/ProcesoCamion.jsx (VERSIÓN FINAL Y CORRECTA)

import React, { Suspense, useState, useEffect } from 'react';
import { useProcesoCamion } from '../../context/ProcesoCamionContext';
import { useAuth } from '../../context/AuthContext';
import { Canvas } from '@react-three/fiber';
import { PesajeInicialUI, PesajeInicialScene } from './PesajeInicial';
import { InspeccionBUI, InspeccionBScene } from './InspeccionB';
import { EvacuacionCalUI, EvacuacionCalScene } from './EvacuacionCal';
import { PesajeFinalUI, PesajeFinalScene } from './PesajeFinal';

const ProcesoCamion = () => {
    const { camionActual, etapaActual, reiniciarProceso, avanzarEtapa, isEtapaDisponible } = useProcesoCamion();
    const { user } = useAuth();
    const [statusTable, setStatusTable] = useState({});
    const [activeCamera, setActiveCamera] = useState('Camera');
    const [animacionEvacuacion, setAnimacionEvacuacion] = useState(null);
    const [animacionPesajeFinal, setAnimacionPesajeFinal] = useState(null);

    useEffect(() => {
        if (etapaActual === 'pesaje-final') {
            setAnimacionPesajeFinal('llegada');
        }
    }, [etapaActual]);

    const handleCameraChange = (cameraName) => {
        setActiveCamera(cameraName);
    };

    const handleInspectionComplete = (partName, status) => {
        setStatusTable(prev => ({ ...prev, [partName]: status }));
    };

    if (!camionActual) {
        return <div className="loading-container">Cargando...</div>;
    }

    // Función para renderizar el contenido según la etapa y el rol
    const renderEtapaContent = () => {
        // Solo mostrar etapas disponibles para el rol actual
        if (!isEtapaDisponible(etapaActual)) {
            return (
                <div className="etapa-no-disponible">
                    <h2>Etapa no disponible para tu rol</h2>
                    <p>Esta etapa no está disponible para usuarios con rol: {user?.rol}</p>
                    <button className="btn-primary" onClick={reiniciarProceso}>
                        Volver al inicio
                    </button>
                </div>
            );
        }

        switch (etapaActual) {
            case 'pesaje-inicial':
                return <PesajeInicialUI />;

            case 'inspeccion-b':
                return (
                    <InspeccionBUI
                        statusTable={statusTable}
                        activeCamera={activeCamera}
                        onCameraChange={handleCameraChange}
                        onInspectionComplete={handleInspectionComplete}
                    />
                );

            case 'evacuacion':
                return (
                    <EvacuacionCalUI
                        onFinalizar={() => {
                            // Después de la evacuación, volver a la lista para que el proceso aparezca en pesaje final
                            reiniciarProceso();
                        }}
                        setAnimacionEvacuacion={setAnimacionEvacuacion}
                    />
                );

            case 'pesaje-final':
                return (
                    <PesajeFinalUI
                        setAnimacionPesajeFinal={setAnimacionPesajeFinal}
                    />
                );

            case 'completado':
                return (
                    <div className="proceso-completado">
                        <h2>Proceso Completado</h2>
                        <button className="btn-primary" onClick={reiniciarProceso}>
                            Volver al inicio
                        </button>
                    </div>
                );

            default:
                return <div>Etapa no reconocida</div>;
        }
    };

    // Función para renderizar la escena 3D según la etapa y el rol
    const renderEtapaScene = () => {
        if (!isEtapaDisponible(etapaActual)) {
            return null;
        }

        switch (etapaActual) {
            case 'pesaje-inicial':
                return <PesajeInicialScene />;

            case 'inspeccion-b':
                return (
                    <InspeccionBScene
                        statusTable={statusTable}
                        activeCamera={activeCamera}
                    />
                );

            case 'evacuacion':
                return (
                    <EvacuacionCalScene
                        animacionEvacuacion={animacionEvacuacion}
                    />
                );

            case 'pesaje-final':
                return (
                    <PesajeFinalScene
                        animacionPesajeFinal={animacionPesajeFinal}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <div className="proceso-camion-page">
            <div className="proceso-header">
                <h1>Proceso para Camión: {camionActual.patente}</h1>
                <div className="proceso-info">
                    <p><strong>Conductor:</strong> {camionActual.nombre_chofer || 'N/A'}</p>
                    <p><strong>Peso Guía:</strong> {camionActual.peso_guia || 0} kg</p>
                    <p><strong>Fecha Ingreso:</strong> {new Date(camionActual.fecha_proceso).toLocaleString('es-CL')}</p>
                    <p><strong>Rol Actual:</strong> {user?.rol || 'N/A'}</p>
                </div>
            </div>

            <div className="proceso-progress">
            </div>

            <div className="proceso-camion-layout">
                <div className="ui-panel">
                    {renderEtapaContent()}
                </div>
                <div className="visual-panel">
                    <Canvas shadows camera={{ position: [-36, 7.5, 22.4], fov: 25 }}>
                        <Suspense fallback={null}>
                            {renderEtapaScene()}
                        </Suspense>
                    </Canvas>
                </div>
            </div>
        </div>
    );
};

export default ProcesoCamion;