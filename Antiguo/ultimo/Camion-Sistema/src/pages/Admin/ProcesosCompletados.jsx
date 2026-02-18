// src/pages/Procesos/ProcesosCompletados.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Para el botón "Ver Detalles"
import { fetchCamiones } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner'; // Reutilizando tu componente de carga

// Función para formatear la fecha a DD/MM/YYYY
const formatearFecha = (fechaISO) => {
    if (!fechaISO) return "N/A";
    return new Date(fechaISO).toLocaleDateString('es-CL');
};

export default function ProcesosCompletados() {
    const [procesos, setProcesos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const cargarProcesosFinalizados = async () => {
            try {
                setLoading(true);
                // 1. Obtenemos la lista completa de procesos
                const data = await fetchCamiones();

                // 2. El paso CLAVE: filtramos para quedarnos solo con los finalizados
                const procesosFinalizados = data.filter(
                    (proceso) => proceso.estado === 'finalizado'
                );

                setProcesos(procesosFinalizados);
                setError(null);
            } catch (err) {
                setError("No se pudo cargar el historial de procesos.");
            } finally {
                setLoading(false);
            }
        };
        cargarProcesosFinalizados();
    }, []);

    if (loading) {
        return <LoadingSpinner message="Cargando historial..." />;
    }

    if (error) {
        return <div className="error-container">{error}</div>;
    }

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            <h1>Historial de Procesos Finalizados</h1>
            <p>Aquí se muestran únicamente las inspecciones que se completaron exitosamente.</p>

            {procesos.length === 0 ? (
                <p>Aún no hay procesos finalizados.</p>
            ) : (
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                            <th style={tableHeaderStyle}>Patente</th>
                            <th style={tableHeaderStyle}>Conductor</th>
                            <th style={tableHeaderStyle}>Fecha de Ingreso</th>
                            <th style={tableHeaderStyle}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {procesos.map((proceso) => (
                            <tr key={proceso.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={tableCellStyle}>{proceso.patente}</td>
                                <td style={tableCellStyle}>{proceso.nombre_chofer || 'N/A'}</td>
                                <td style={tableCellStyle}>{formatearFecha(proceso.fecha_proceso)}</td>
                                <td style={tableCellStyle}>
                                    {/* Este botón te llevará a una página de detalles del proceso */}
                                    <Link to={`/proceso/${proceso.id}/detalles`} className="btn-secondary">
                                        Ver Detalles
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// Estilos básicos para la tabla
const tableHeaderStyle = {
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #dee2e6'
};

const tableCellStyle = {
    padding: '12px',
    textAlign: 'left'
};