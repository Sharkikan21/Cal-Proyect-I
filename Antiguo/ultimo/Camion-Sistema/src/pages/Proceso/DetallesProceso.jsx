// src/DetallesProceso.jsx

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCamionById } from '../../services/api'; // Usamos la misma función de API
import { FaTruck, FaUser, FaCalendarAlt, FaWeightHanging, FaHourglass, FaClipboardCheck, FaArrowLeft } from 'react-icons/fa';
import '../../styles/DetallesInspeccion.css';
import { useProcesoLock } from "../../hooks/useProcesoLock";
import { toast } from "react-toastify";

const DetallesProceso = () => {
    const { id: procesoId } = useParams();
    const [proceso, setProceso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { hasLock, holder, takeLock, releaseLock } = useProcesoLock(procesoId);

    // helper: toma el lock en el primer intento de acción
    const ensureLockOrExplain = async () => {
        if (hasLock) return true;
        const ok = await takeLock();
        if (!ok) {
            // muestra quién lo tiene
            toast?.error?.(`No puedes editar: lo está trabajando ${holder}.`);
            return false;
        }
        toast?.success?.("Tienes el control de este proceso.");
        return true;
    };


    useEffect(() => {
        const fetchDetalles = async () => {
            try {
                setLoading(true);
                const data = await getCamionById(procesoId);
                setProceso(data);
            } catch (err) {
                setError("Error al cargar los detalles del proceso.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetalles();
    }, [procesoId]);

    if (loading) return <div>Cargando detalles...</div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!proceso) return <div>No se encontraron datos para este proceso.</div>;

    // --- Lógica para procesar los datos ---
    const pesajeInicial = proceso.pesajes_registrados?.find(p => p.tipo === 'inicial');
    const pesajeFinal = proceso.pesajes_registrados?.find(p => p.tipo === 'final');
    const pesoNetoReal = pesajeInicial && pesajeFinal ? pesajeInicial.peso_kg - pesajeFinal.peso_kg : 0;
    const diferenciaVsGuia = pesoNetoReal - (proceso.peso_guia || 0);

    const formatoFecha = (fecha) => fecha ? new Date(fecha).toLocaleString('es-CL') : 'N/A';

    return (
        <div className="detalles-inspeccion-page">
            <div className="page-header">
                <header className="flex items-center gap-3" style={{ margin: "8px 0" }}>
                    {hasLock ? (
                        <span className="badge badge-success">Tienes el control</span>
                    ) : holder ? (
                        <span className="badge badge-warning">En uso por {holder}</span>
                    ) : (
                        <span className="badge">Disponible</span>
                    )}
                    {hasLock && (
                        <button className="btn-secondary" onClick={() => releaseLock()}>
                            Liberar
                        </button>
                    )}
                    {!hasLock && !holder && (
                        <button className="btn-outline" onClick={() => takeLock()}>
                            Tomar control
                        </button>
                    )}
                </header>
                <h1>Detalle del Proceso: {proceso.patente}</h1>
                <p>
                    <strong>Conductor:</strong> {proceso.nombre_chofer || 'N/A'} |
                    <strong> Acoplado:</strong> {proceso.patente_acoplado || 'N/A'}
                </p>
                <p>
                    <strong>Inicio del Proceso:</strong> {formatoFecha(proceso.fecha_proceso)}
                </p>
                <p>
                    <strong>Estado Actual:</strong>
                    <span className={`status-pill ${proceso.estado === 'finalizado' ? 'finalizado' : 'pendiente'}`}>
                        {proceso.estado}
                    </span>
                </p>
            </div>
            <div className="inspeccion-section">
                <h2><FaTruck /> Información General</h2>
                <table className="inspeccion-table">
                    <tbody>
                        <tr><td><strong>Usuario Recepción:</strong></td><td>{proceso.usuario_id_recepcion || 'N/A'}</td></tr>
                        <tr><td><strong>Usuario Finalización:</strong></td><td>{proceso.usuario_id_finalizacion || 'N/A'}</td></tr>
                        <tr><td><strong>Fin Proceso:</strong></td><td>{formatoFecha(proceso.updated_at)}</td></tr>
                    </tbody>
                </table>
            </div>

            <div className="inspeccion-section">
                <h2><FaWeightHanging /> Resumen de Pesajes</h2>
                <table className="inspeccion-table">
                    <tbody>
                        <tr><td><strong>Peso Bruto (Inicial):</strong></td><td>{pesajeInicial?.peso_kg || 0} kg</td></tr>
                        <tr><td><strong>Peso Tara (Final):</strong></td><td>{pesajeFinal?.peso_kg || 0} kg</td></tr>
                        <tr><td><strong>Peso Neto (Real):</strong></td><td>{pesoNetoReal.toFixed(2)} kg</td></tr>
                        <tr><td><strong>Peso Neto (Según Guía):</strong></td><td>{proceso.peso_guia || 0} kg</td></tr>
                        <tr><td><strong>Diferencia vs. Guía:</strong></td><td>{diferenciaVsGuia.toFixed(2)} kg</td></tr>
                    </tbody>
                </table>
            </div>

            <div className="inspeccion-section">
                <h2><FaHourglass /> Detalles de la Descarga</h2>
                <table className="inspeccion-table">
                    <tbody>
                        <tr><td><strong>Duración:</strong></td><td>{proceso.evacuacion_registrada?.tiempo_minutos || 0} minutos</td></tr>
                        <tr><td><strong>Observaciones:</strong></td><td>{proceso.evacuacion_registrada?.observaciones || 'Sin observaciones.'}</td></tr>
                    </tbody>
                </table>
            </div>

            {/* --- CAMBIADO: La lista de inspecciones ahora es una tabla formateada --- */}
            <div className="inspeccion-section">
                <h2><FaClipboardCheck /> Resultados de Inspección</h2>
                <table className="inspeccion-table">
                    <thead>
                        <tr>
                            <th>Parte Inspeccionada</th>
                            <th>Estado</th>
                            <th>Información Adicional</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proceso.inspecciones_realizadas?.map(inspeccion => (
                            <tr key={inspeccion.id}>
                                <td data-label="Parte">{inspeccion.nombre_parte}</td>
                                <td data-label="Estado">
                                    <span className={
                                        ['bien', 'ok', 'cumple'].includes(inspeccion.estado?.toLowerCase()) ? 'status-ok' :
                                            ['mal', 'no cumple'].includes(inspeccion.estado?.toLowerCase()) ? 'status-nok' :
                                                'status-obs'
                                    }>
                                        {inspeccion.estado}
                                    </span>
                                </td>
                                <td data-label="Info">{inspeccion.informacion || 'Ninguna'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <Link to="/home" className="btn-secondary">
                    <FaArrowLeft /> Volver a la lista
                </Link>
            </div>
        </div>
    );
};

export default DetallesProceso;