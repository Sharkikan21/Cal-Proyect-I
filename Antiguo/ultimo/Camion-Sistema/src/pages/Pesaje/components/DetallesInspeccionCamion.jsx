// File: src/pages/Pesaje/components/DetallesInspeccionCamion.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCamionById } from '../services/api';

const DetallesInspeccionCamion = () => {
    const { documentacion_id } = useParams();
    const [camionConDetalles, setCamionConDetalles] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetalles = async () => {
            try {
                setLoading(true);
                console.log(`[DEBUG] Iniciando búsqueda de detalles para el ID: ${documentacion_id}`);
                const data = await getCamionById(documentacion_id);
                console.log("[DEBUG] Datos recibidos de la API:", data);
                setCamionConDetalles(data);
                setError(null);
            } catch (err) {
                console.error("[DEBUG] La llamada a la API falló. Error:", err);
                setError(err.message || 'Error al cargar los detalles del camión.');
            } finally {
                setLoading(false);
            }
        };

        if (documentacion_id) {
            fetchDetalles();
        } else {
            console.warn("[DEBUG] No se encontró un 'documentacion_id' en la URL, no se puede buscar.");
        }
    }, [documentacion_id]);
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Cargando detalles de inspección...</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="error-container">
                <p className="error-message">{error}</p>
                <Link to="/" className="btn-primary">Volver al Inicio</Link>
            </div>
        );
    }

    if (!camionConDetalles) {
        return <p>No se encontraron datos para este camión.</p>;
    }
    const checklistAItems = [
        "carnet_conducir", "carnet_identidad", "hoja_seguridad", "protocolo_derrames"
    ];
    const inspeccionesChecklistA = [];
    const inspeccionesGenerales = [];

    if (camionConDetalles.inspecciones_realizadas) {
        camionConDetalles.inspecciones_realizadas.forEach(insp => {
            inspeccionesGenerales.push(insp);
        });
    }
    checklistAItems.forEach(itemKey => {
        if (camionConDetalles.hasOwnProperty(itemKey)) {
            inspeccionesChecklistA.push({
                parte: itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                estado: camionConDetalles[itemKey] ? 'Cumple' : 'No Cumple',
                informacion: ''
            });
        }
    });
    console.log("Datos recibidos para detalles:", camionConDetalles);
    return (
        <div className="detalles-inspeccion-page">
            <div className="page-header">
                <h1>Detalles de Inspección del Camión: {camionConDetalles.patente}</h1>
                <p><strong>Conductor:</strong> {camionConDetalles.conductor}</p>
                <p>
                    <strong>Fecha Ingreso:</strong>
                    {camionConDetalles.fecha_proceso
                        ? new Date(camionConDetalles.fecha_proceso).toLocaleString('es-CL')
                        : 'No registrada'
                    }
                </p>
                <p><strong>Estado Actual:</strong> <span className={`status-pill ${camionConDetalles.estado === 'finalizado' ? 'finalizado' : 'pendiente'}`}>{camionConDetalles.estado}</span></p>
            </div>
            {inspeccionesChecklistA.length > 0 && (
                <div className="inspeccion-section">
                    <h2>Checklist Documentación (Checklist A)</h2>
                    <table className="inspeccion-table">
                        <thead>
                            <tr>
                                <th>Elemento</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inspeccionesChecklistA.map((item, index) => (
                                <tr key={`checklistA-${index}`}>
                                    <td>{item.parte}</td>
                                    <td>
                                        <span className={item.estado === 'Cumple' ? 'status-ok' : 'status-nok'}>
                                            {item.estado}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {inspeccionesGenerales.length > 0 ? (
                <div className="inspeccion-section">
                    <h2>Detalle de Partes Inspeccionadas (Checklist A y B)</h2>
                    <table className="inspeccion-table">
                        <thead>
                            <tr>
                                <th>Parte Inspeccionada</th>
                                <th>Estado</th>
                                <th>Información Adicional</th>
                                <th>Fecha Inspección</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inspeccionesGenerales.map((insp, index) => (
                                <tr key={`insp-${index}`}>
                                    <td>{insp.parte}</td>
                                    <td>
                                        <span className={insp.estado && insp.estado.toLowerCase() === 'ok' || insp.estado.toLowerCase() === 'bien' || insp.estado.toLowerCase() === 'verde' ? 'status-ok' : insp.estado && insp.estado.toLowerCase() === 'rojo' || insp.estado.toLowerCase() === 'mal estado' ? 'status-nok' : 'status-obs'}>
                                            {insp.estado || 'N/A'}
                                        </span>
                                    </td>
                                    <td>{insp.informacion || 'Ninguna'}</td>
                                    <td>{insp.fecha_inspeccion ? new Date(insp.fecha_inspeccion).toLocaleString('es-CL') : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>No se registraron inspecciones detalladas de partes para este camión.</p>
            )}

            <div style={{ marginTop: '20px' }}>
                <Link to="/" className="btn-secondary">Volver a la lista</Link>
            </div>
        </div>
    );
};

export default DetallesInspeccionCamion;