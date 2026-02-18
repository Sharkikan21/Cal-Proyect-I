// src/components/Admin/ManguerasAdmin.jsx

import React, { useState, useEffect } from 'react';
import { manguerasApi, obtenerEstadoManguera } from "../../services/manguerasAPI";
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaPlus, FaEdit, FaTrash, FaExclamationTriangle, FaCheck, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import "../../styles/MangueraAdmin.css";
import { limpiarProcesosAbandonados, apiCall } from '../../services/api';

const ManguerasAdmin = () => {
    const { user } = useAuth();
    const [mangueras, setMangueras] = useState([]);
    const [tiposMangueras, setTiposMangueras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingManguera, setEditingManguera] = useState(null);
    const [codigoPrefijo, setCodigoPrefijo] = useState('');
    const [formData, setFormData] = useState({
        codigo_manguera: '',
        tipo_manguera_id: '',
        horas_uso_actual: 0,
        fecha_ingreso: '',
        observaciones: ''
    });

    useEffect(() => {
        if (user?.rol !== 'admin') {
            setError('No tienes permisos para acceder a esta sección');
            return;
        }
        cargarDatos();
    }, [user?.rol]);

    const cargarDatos = async () => {
        try {
            setLoading(true);

            const [manguerasData, tiposData] = await Promise.all([
                manguerasApi.obtenerTodasLasMangueras(),
                apiCall('/api/tipos-mangueras')   // ← sin .then(...)
            ]);

            setMangueras(manguerasData);
            // si tu backend devuelve lista directa o {items:[...]}, ambas funcionan:
            setTiposMangueras(Array.isArray(tiposData) ? tiposData : (tiposData?.items ?? []));
        } catch (err) {
            setError('Error al cargar los datos');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLimpieza = async () => {
        if (window.confirm("¿Está seguro de que desea liberar las mangueras de todos los procesos abandonados? Esta acción no se puede deshacer.")) {
            try {
                // Llama a la función de la API que ejecuta la limpieza en el backend
                const resultado = await limpiarProcesosAbandonados();
                alert(resultado.message); // Muestra el mensaje de éxito del backend
                cargarDatos(); // Vuelve a cargar los datos para reflejar los cambios
            } catch (error) {
                alert("Error al ejecutar la limpieza: " + (error.message || "Error desconocido"));
            }
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingManguera) {
                const datosParaActualizar = {
                    horas_uso_actual: formData.horas_uso_actual,
                    fecha_ingreso: formData.fecha_ingreso,
                    observaciones: formData.observaciones
                };
                await manguerasApi.actualizarManguera(editingManguera.id, datosParaActualizar);

            } else {
                const datosParaCrear = {
                    ...formData,
                    horas_uso_actual: formData.horas_uso_actual === '' ? 0 : formData.horas_uso_actual,
                };

                await manguerasApi.crearManguera(datosParaCrear);
            }
            setShowModal(false);
            setEditingManguera(null);
            setFormData({
                codigo_manguera: '',
                tipo_manguera_id: '',
                horas_uso_actual: '',
                fecha_ingreso: '',
                observaciones: ''
            });

            cargarDatos();
        } catch (err) {
            setError('Error al guardar la manguera');
            console.error(err);
        }
    };

    const handleEdit = (manguera) => {
        setEditingManguera(manguera);
        setFormData({
            codigo_manguera: manguera.codigo_manguera,
            tipo_manguera_id: manguera.tipo_manguera_id,
            horas_uso_actual: manguera.horas_uso_actual,
            fecha_ingreso: manguera.fecha_ingreso,
            observaciones: manguera.observaciones || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (mangueraId) => {
        if (window.confirm('¿Está seguro de que desea retirar esta manguera?')) {
            try {
                await manguerasApi.retirarManguera(mangueraId, 'Retirada por administrador');
                cargarDatos();
            } catch (err) {
                setError('Error al retirar la manguera');
                console.error(err);
            }
        }
    };
    const handleTipoMangueraChange = (e) => {
        const tipoId = e.target.value;
        if (!tipoId) {
            setFormData({ ...formData, tipo_manguera_id: '', codigo_manguera: '' });
            setCodigoPrefijo(''); // Limpiar prefijo
            return;
        }
        const tipoSeleccionado = tiposMangueras.find(tipo => tipo.id.toString() === tipoId);
        let prefijo = '';
        if (tipoSeleccionado) {
            prefijo = `${tipoSeleccionado.nombre.toUpperCase()}-`;
        }
        setCodigoPrefijo(prefijo);
        setFormData({
            ...formData,
            tipo_manguera_id: tipoId,
            codigo_manguera: prefijo
        });
    };
    const handleCodigoChange = (e) => {
        const nuevoValor = e.target.value;
        if (codigoPrefijo && !nuevoValor.startsWith(codigoPrefijo)) {
            return;
        }
        const parteNumerica = nuevoValor.slice(codigoPrefijo.length);
        if (parteNumerica.length > 3 || (parteNumerica && !/^[0-9]*$/.test(parteNumerica))) {
            return;
        }
        setFormData({ ...formData, codigo_manguera: nuevoValor });
    };
    const handleHorasChange = (e) => {
        const valorInput = e.target.value;
        if (valorInput === '') {
            setFormData({ ...formData, horas_uso_actual: '' });
            return;
        }
        const nuevasHoras = parseInt(valorInput, 10);
        if (isNaN(nuevasHoras)) {
            return;
        }
        const tipoSeleccionado = tiposMangueras.find(
            (t) => t.id.toString() === formData.tipo_manguera_id
        );
        const maxHoras = tipoSeleccionado ? tipoSeleccionado.vida_util_horas : Infinity;
        if (nuevasHoras >= 0 && nuevasHoras <= maxHoras) {
            setFormData({ ...formData, horas_uso_actual: nuevasHoras });
        }
    };

    const actualizarHoras = async (mangueraId, nuevasHoras) => {
        try {
            await manguerasApi.actualizarHorasUso(mangueraId, nuevasHoras);
            cargarDatos();
        } catch (err) {
            setError('Error al actualizar las horas');
            console.error(err);
        }
    };

    if (user?.rol !== 'admin') {
        return (
            <div className="admin-container">
                <div className="error-message">
                    No tienes permisos para acceder a esta sección
                </div>
            </div>
        );
    }

    if (loading) {
        return <LoadingSpinner message="Cargando mangueras..." />;
    }

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1>Administración de Mangueras</h1>

                <div className="header-actions">
                    <button className="limpieza-button" onClick={handleLimpieza}>
                        ⚠️ Liberar Mangueras Atrapadas
                    </button>

                    <button className="nueva-manguera-button" onClick={() => setShowModal(true)}>
                        + Nueva Manguera
                    </button>
                </div>
            </div>


            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            <div className="table-container">
                <table className="mangueras-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Tipo</th>
                            <th>Fecha de Ingreso</th>
                            <th>Uso / Vida Útil (Horas)</th>
                            <th>Progreso de Uso</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mangueras.map(manguera => {
                            const estado = obtenerEstadoManguera(manguera.horas_uso_actual, manguera.vida_util_horas);
                            const porcentajeUso = (manguera.horas_uso_actual / manguera.vida_util_horas) * 100;

                            return (
                                <tr key={manguera.id}>
                                    <td data-label="Código"><strong>{manguera.codigo_manguera}</strong></td>
                                    <td data-label="Tipo">{manguera.tipo_manguera}</td>
                                    <td data-label="Fecha de Ingreso">
                                        {manguera.fecha_ingreso ? new Date(manguera.fecha_ingreso).toLocaleDateString('es-CL') : 'N/A'}
                                    </td>
                                    <td data-label="Uso / Vida Útil">{Math.round(manguera.horas_uso_actual)} / {manguera.vida_util_horas}h</td>
                                    <td data-label="Progreso" className="progress-cell">
                                        <div className="progress-bar-container">
                                            <div
                                                className="progress-bar-fill"
                                                style={{
                                                    width: `${Math.min(porcentajeUso, 100)}%`,
                                                    backgroundColor: estado.color
                                                }}
                                            ></div>
                                        </div>
                                        <span className="progress-text">{Math.round(porcentajeUso)}%</span>
                                    </td>
                                    <td data-label="Estado">
                                        <div className="status-cell">
                                            <span className={`status-icon status-${estado.nivel}`}></span>
                                            <span>{estado.texto}</span>
                                        </div>
                                    </td>
                                    <td data-label="Acciones">
                                        <div className="table-actions">
                                            <button onClick={() => handleEdit(manguera)} title="Editar">
                                                <FaEdit />
                                            </button>
                                            <button onClick={() => handleDelete(manguera.id)} title="Retirar">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal para crear/editar manguera */}
            {showModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowModal(false)}></div>
                    <div className="modal-form">
                        <div className="modal-header">
                            <h3>{editingManguera ? 'Editar Manguera' : 'Nueva Manguera'}</h3>
                            <button onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Tipo de Manguera</label>
                                <select
                                    value={formData.tipo_manguera_id}
                                    onChange={handleTipoMangueraChange}
                                    required
                                    disabled={!!editingManguera}
                                >
                                    <option value="">Seleccionar tipo</option>
                                    {tiposMangueras.map(tipo => (
                                        <option key={tipo.id} value={tipo.id}>
                                            {tipo.nombre} (Vida útil: {tipo.vida_util_horas}h)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Código de Manguera</label>
                                <input
                                    type="text"
                                    value={formData.codigo_manguera}
                                    onChange={handleCodigoChange}
                                    required
                                    placeholder="Selecciona un tipo para generar el prefijo"
                                    disabled={!!editingManguera}
                                />
                            </div>
                            <div className="form-group">
                                <label>Horas de uso actual</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.horas_uso_actual}
                                    onChange={handleHorasChange} // <-- CAMBIO AQUÍ
                                />
                            </div>

                            <div className="form-group">
                                <label>Fecha de Ingreso</label> {/* <-- CAMBIAR ETIQUETA */}
                                <input
                                    type="date"
                                    value={formData.fecha_ingreso}
                                    onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Observaciones</label>
                                <textarea
                                    value={formData.observaciones}
                                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                                    rows="3"
                                />
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn-primary">
                                    {editingManguera ? 'Actualizar' : 'Crear'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
};

export default ManguerasAdmin;