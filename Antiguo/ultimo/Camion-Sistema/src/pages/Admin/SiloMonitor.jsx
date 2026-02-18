import React, { useState, useMemo } from 'react';
import '../../styles/SiloMonitor.css';

// --- Pequeños componentes para mantener el código limpio ---
const SiloGraphic = ({ percentage }) => (
    <div className="silo-container">
        <div id="silo-fill" style={{ height: `${percentage}%` }}></div>
    </div>
);

const SiloAlert = ({ percentage }) => {
    let alertInfo = { text: 'Operación normal', className: 'alert-normal' };
    if (percentage < 10) {
        alertInfo = { text: 'Peligro: Falta de cal', className: 'alert-peligro' };
    } else if (percentage <= 20) {
        alertInfo = { text: 'Solicitar cal urgente', className: 'alert-urgente' };
    } else if (percentage <= 30) {
        alertInfo = { text: 'Solicitar cal hoy', className: 'alert-solicitar' };
    }
    return <div className={`alert ${alertInfo.className}`}>{alertInfo.text}</div>;
};

// --- Componente Principal Actualizado ---
export default function SiloMonitor() {
    // 1. ESTADO INICIAL: No hay configuración al principio.
    const [siloConfig, setSiloConfig] = useState(null);
    const [currentLevel, setCurrentLevel] = useState(0);

    // Datos de ejemplo para la tabla de registros. En una app real, vendrían de la BD.
    const [levelLog, setLevelLog] = useState([
        { date: '15/07/2025 03:00', tons: 67.0, percentage: 80.7 },
        { date: '15/07/2025 02:30', tons: 67.8, percentage: 81.7 },
        { date: '15/07/2025 02:00', tons: 68.5, percentage: 82.5 },
        { date: '15/07/2025 01:30', tons: 69.1, percentage: 83.3 },
    ]);

    // Función para guardar la configuración desde el formulario
    const handleConfigSave = (configData) => {
        const { diametro, altura, densidad } = configData;
        const radio = diametro / 2;
        const volumen = Math.PI * Math.pow(radio, 2) * altura;
        const maxCapacityTons = volumen * densidad;

        setSiloConfig({ ...configData, maxCapacityTons });
        setCurrentLevel(maxCapacityTons * 0.8); // Iniciar simulación al 80%
    };

    // --- RENDERIZADO CONDICIONAL ---
    // Si no hay configuración, muestra el formulario. Si la hay, muestra el dashboard.
    if (!siloConfig) {
        return <ConfigForm onSave={handleConfigSave} />;
    }

    // Si ya hay configuración, renderiza el Dashboard de Monitoreo
    const percentage = (currentLevel / siloConfig.maxCapacityTons) * 100;
    const isReceptionBlocked = percentage >= 80;

    return (
        <div className="container">
            <h1>📊 Nivel del Silo de Cal</h1>
            <SiloGraphic percentage={percentage} />
            <h2 id="level-percentage">{percentage.toFixed(0)}%</h2>
            <p id="level-tons">
                {currentLevel.toFixed(1)} / {siloConfig.maxCapacityTons.toFixed(1)} toneladas
            </p>
            <SiloAlert percentage={percentage} />
            <button id="btn-recepcion" disabled={isReceptionBlocked}>
                Iniciar Recepción de Cal
            </button>
            {isReceptionBlocked && (
                <p className="tooltip-text">Recepción bloqueada: Nivel superior al 80%.</p>
            )}

            {/* Simulación para probar */}
            <div className="simulation-controls">
                <label htmlFor="level-slider">Simular Nivel del Silo</label>
                <input
                    type="range" id="level-slider" min="0"
                    max={siloConfig.maxCapacityTons}
                    value={currentLevel}
                    onChange={(e) => setCurrentLevel(parseFloat(e.target.value))}
                />
            </div>
            <div className="log-table-container">
                <h3>Historial de Niveles</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha/Hora</th>
                            <th>Nivel (ton)</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {levelLog.map((log, index) => (
                            <tr key={index}>
                                <td>{log.date}</td>
                                <td>{log.tons.toFixed(1)}</td>
                                <td>{log.percentage.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
function ConfigForm({ onSave }) {
    const [formData, setFormData] = useState({
        diametro: '3',
        altura: '12',
        densidad: '0.98',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const { diametro, altura, densidad } = formData;
        if (diametro > 0 && altura > 0 && densidad > 0) {
            onSave({
                diametro: parseFloat(diametro),
                altura: parseFloat(altura),
                densidad: parseFloat(densidad),
            });
        } else {
            alert("Todos los valores deben ser números positivos.");
        }
    };

    return (
        <div className="container">
            <form onSubmit={handleSubmit} className="config-form">
                <h1>⚙️ Configurar Parámetros del Silo</h1>
                <p>Ingrese los datos fijos del silo para calcular su capacidad máxima.</p>
                <div className="input-group">
                    <label htmlFor="diametro">Diámetro del silo (m)</label>
                    <input type="number" id="diametro" name="diametro" value={formData.diametro} onChange={handleChange} step="0.1" required />
                </div>
                <div className="input-group">
                    <label htmlFor="altura">Altura del silo (m)</label>
                    <input type="number" id="altura" name="altura" value={formData.altura} onChange={handleChange} step="0.1" required />
                </div>
                <div className="input-group">
                    <label htmlFor="densidad">Densidad de la cal (ton/m³)</label>
                    <input type="number" id="densidad" name="densidad" value={formData.densidad} onChange={handleChange} step="0.01" required />
                </div>
                <button type="submit" className="btn-primary">Guardar Configuración</button>
            </form>
        </div>
    );
}