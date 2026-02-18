// Ubicación: src/pages/recepcion-cal/RecepcionCal.jsx

import React, { Suspense, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Canvas } from '@react-three/fiber';
import { InspeccionBUI, InspeccionBScene } from './components/InspeccionB';
import { EvacuacionCalUI, EvacuacionCalScene } from './components/EvacuacionCal';
import { useProcesoCamion } from '../../context/ProcesoCamionContext';

// Componente interno que maneja la lógica de recepción cal
export default function RecepcionCal() {
    const { user } = useAuth();
    const { camionActual, etapaActual, reiniciarProceso, avanzarEtapa, isEtapaDisponible } = useProcesoCamion();
    const [statusTable, setStatusTable] = useState({});
    const [activeCamera, setActiveCamera] = useState('Camera');
    const [animacionEvacuacion, setAnimacionEvacuacion] = useState(null);

    // Debugging logs
    console.log("[RecepcionCal] Renderizando con:", {
        camionActual: camionActual?.patente,
        etapaActual,
        userRol: user?.rol,
        isEtapaDisponible: isEtapaDisponible(etapaActual)
    });

    const handleCameraChange = (cameraName) => {
        setActiveCamera(cameraName);
    };

    const handleInspectionComplete = (partName, status) => {
        setStatusTable(prev => ({ ...prev, [partName]: status }));
    };

    // Si no hay camión seleccionado, no debería llegar aquí
    if (!camionActual) {
        return <div className="loading-container">Cargando...</div>;
    }

    // Función para renderizar el contenido según la etapa
    const renderEtapaContent = () => {
        console.log("[RecepcionCal] renderEtapaContent - etapaActual:", etapaActual);
        console.log("[RecepcionCal] isEtapaDisponible:", isEtapaDisponible(etapaActual));

        // Verificar si la etapa es válida para Recepción Cal
        const etapasValidasRecepcionCal = ['inspeccion-b', 'evacuacion', 'completado'];

        if (!etapasValidasRecepcionCal.includes(etapaActual)) {
            console.log("[RecepcionCal] Etapa no válida para Recepción Cal:", etapaActual);
            return (
                <div className="etapa-no-disponible">
                    <h2>Proceso no disponible en Recepción Cal</h2>
                    <p>Este proceso está en la etapa "{etapaActual}" que no corresponde a Recepción Cal.</p>
                    <p>El proceso debe estar en etapa de Inspección B o Evacuación para ser procesado aquí.</p>
                    <button className="btn-primary" onClick={reiniciarProceso}>
                        Volver al inicio
                    </button>
                </div>
            );
        }

        if (!isEtapaDisponible(etapaActual)) {
            return (
                <div className="etapa-no-disponible">
                    <h2>Etapa no disponible para tu rol</h2>
                    <p>Esta etapa no está disponible para usuarios con rol: {user?.rol}</p>
                    <p>Etapa actual: {etapaActual}</p>
                    <button className="btn-primary" onClick={reiniciarProceso}>
                        Volver al inicio
                    </button>
                </div>
            );
        }

        switch (etapaActual) {
            case 'inspeccion-b':
                console.log("[RecepcionCal] Renderizando InspeccionBUI");
                return (
                    <InspeccionBUI
                        statusTable={statusTable}
                        activeCamera={activeCamera}
                        onCameraChange={handleCameraChange}
                        onInspectionComplete={handleInspectionComplete}
                    />
                );

            case 'evacuacion':
                console.log("[RecepcionCal] Renderizando EvacuacionCalUI");
                return (
                    <EvacuacionCalUI
                        onFinalizar={() => {
                            // Después de la evacuación, volver a la lista para que el proceso aparezca en pesaje final
                            reiniciarProceso();
                        }}
                        setAnimacionEvacuacion={setAnimacionEvacuacion}
                    />
                );

            case 'completado':
                console.log("[RecepcionCal] Renderizando proceso completado");
                return (
                    <div className="proceso-completado">
                        <h2>Proceso de Recepción Cal Completado</h2>
                        <p>El camión ha sido inspeccionado y la cal ha sido evacuada.</p>
                        <p>El proceso ahora puede continuar en la vista de Pesaje.</p>
                        <button className="btn-primary" onClick={reiniciarProceso}>
                            Volver al inicio
                        </button>
                    </div>
                );

            default:
                console.log("[RecepcionCal] Etapa no reconocida:", etapaActual);
                return (
                    <div className="etapa-no-disponible">
                        <h2>Etapa no reconocida</h2>
                        <p>La etapa "{etapaActual}" no está configurada para Recepción Cal.</p>
                        <button className="btn-primary" onClick={reiniciarProceso}>
                            Volver al inicio
                        </button>
                    </div>
                );
        }
    };

    // Función para renderizar la escena 3D según la etapa
    const renderEtapaScene = () => {
        console.log("[RecepcionCal] renderEtapaScene - etapaActual:", etapaActual);
        console.log("[RecepcionCal] isEtapaDisponible:", isEtapaDisponible(etapaActual));

        if (!isEtapaDisponible(etapaActual)) {
            console.log("[RecepcionCal] No renderizando escena - etapa no disponible");
            return null;
        }

        switch (etapaActual) {
            case 'inspeccion-b':
                console.log("[RecepcionCal] Renderizando InspeccionBScene");
                return (
                    <InspeccionBScene
                        statusTable={statusTable}
                        activeCamera={activeCamera}
                    />
                );

            case 'evacuacion':
                console.log("[RecepcionCal] Renderizando EvacuacionCalScene");
                return (
                    <EvacuacionCalScene
                        animacionEvacuacion={animacionEvacuacion}
                    />
                );

            default:
                console.log("[RecepcionCal] No renderizando escena para etapa:", etapaActual);
                return null;
        }
    };

    return (
        <div className="recepcion-cal-page">
            <div className="proceso-header">
                <h1>Recepción Cal - Camión: {camionActual.patente}</h1>
                <div className="proceso-info">
                    <p><strong>Conductor:</strong> {camionActual.nombre_chofer || 'N/A'}</p>
                    <p><strong>Peso Guía:</strong> {camionActual.peso_guia || 0} kg</p>
                    <p><strong>Fecha Ingreso:</strong> {new Date(camionActual.fecha_proceso).toLocaleString('es-CL')}</p>
                    <p><strong>Rol Actual:</strong> {user?.rol || 'N/A'}</p>
                </div>
            </div>

            <div className="proceso-progress">
                <div className="progress-steps">
                    <div className={`step ${etapaActual === 'inspeccion-b' ? 'active' : ''}`}>
                        Inspección
                    </div>
                    <div className={`step ${etapaActual === 'evacuacion' ? 'active' : ''}`}>
                        Descarga de Cal
                    </div>
                </div>
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
} 