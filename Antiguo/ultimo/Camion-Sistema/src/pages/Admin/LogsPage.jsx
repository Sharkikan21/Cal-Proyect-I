// src/pages/Admin/LogsPage.jsx

import { useState, useEffect } from 'react';
import { fetchActivityLogs } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function LogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getLogs = async () => {
            try {
                setLoading(true);
                const data = await fetchActivityLogs();
                setLogs(data);
            } catch (err) {
                setError("No se pudo cargar el registro de actividades.");
            } finally {
                setLoading(false);
            }
        };
        getLogs();
    }, []);

    if (loading) {
        return <LoadingSpinner message="Cargando registros..." />;
    }

    if (error) {
        return <div className="error-container">{error}</div>;
    }

    return (
        <div className="logs-page-container">
            <h1>Registro de Actividad (Trazabilidad)</h1>
            <p>Aquí se muestran las últimas acciones realizadas en el sistema.</p>

            <div className="logs-list">
                {logs.length === 0 ? (
                    <p>No hay actividades registradas.</p>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="log-item" style={logItemStyle}>
                            <p><strong>Fecha:</strong> {new Date(log.timestamp).toLocaleString('es-CL')}</p>
                            <p><strong>Usuario:</strong> {log.usuario_email}</p>
                            <p><strong>Acción:</strong> <span style={accionStyle}>{log.accion}</span></p>
                            {log.detalles && (
                                <p><strong>Detalles:</strong> <pre style={preStyle}>{JSON.stringify(log.detalles, null, 2)}</pre></p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Estilos básicos para la página, puedes moverlos a un archivo CSS
const logItemStyle = {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};

const accionStyle = {
    background: '#eef2ff',
    color: '#4338ca',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace'
};

const preStyle = {
    background: '#f8f9fa',
    padding: '10px',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
};