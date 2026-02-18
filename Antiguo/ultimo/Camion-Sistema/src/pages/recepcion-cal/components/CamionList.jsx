"use client"

// Ubicación: src/pages/recepcion-cal/components/CamionList.jsx

import { useState, useEffect, useCallback } from "react"
import { useProcesoCamion } from "../../../context/ProcesoCamionContext"
import { useAuth } from "../../../context/AuthContext"
import { fetchProcesos, getCamionById, lockProceso } from "../../../services/api"
import { FaTruck, FaUser, FaWeight, FaCalendarAlt, FaSearch, FaCheck, FaArrowDown, FaArrowUp, FaClipboardCheck, FaExclamationTriangle, FaSpinner, FaPause } from "react-icons/fa"
import { TbTruckLoading } from "react-icons/tb"
import "../../../styles/CamionListRC.css"
import { useNavigate } from "react-router-dom";
const LockPill = ({ state, holder }) => {
    const taken = state === "tomado";
    const bg = taken ? "#fff7ed" : "#ecfdf5";
    const color = taken ? "#d30c0cff" : "#12920eff";
    const text = taken ? `En uso por ${holder || "otro usuario"}` : "Disponible";
    const icon = taken ? "🔒" : "🟢";
    return (
        <span
            style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 8px", borderRadius: 999, background: bg, color,
                border: "1px solid rgba(0,0,0,.08)", fontSize: 12, fontWeight: 600
            }}
            title={taken ? "Bloqueado" : "Libre"}
        >
            <span aria-hidden>{icon}</span>
            {text}
        </span>
    );
};
const ProcessSkeleton = () => (
    <div className="proceso-skeleton">
        <div className="skeleton-row">
            <div className="skeleton-item short"></div>
            <div className="skeleton-item medium"></div>
            <div className="skeleton-item long"></div>
            <div className="skeleton-item short"></div>
            <div className="skeleton-item medium"></div>
            <div className="skeleton-item pill"></div>
            <div className="skeleton-item progress"></div>
            <div className="skeleton-item button"></div>
        </div>
    </div>
);


export default function CamionList() {
    const [camiones, setCamiones] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { user } = useAuth()

    // Estados para la UI (filtros, orden, etc.)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState("fecha_proceso")
    const [sortOrder, setSortOrder] = useState("desc")
    const { iniciarProceso } = useProcesoCamion()

    const handleSort = (key) => {
        const newOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc"
        setSortBy(key)
        setSortOrder(newOrder)
    }

    const getCamiones = async () => {
        try {
            setLoading(true)
            console.log("[RecepcionCal CamionList] Cargando camiones...")
            const resp = await fetchProcesos({ estado: 'pendiente-recepcion', q: searchTerm, limit: 30, offset: 0 });
            setCamiones(resp.items || []);
            setError(null)
        } catch (err) {
            setError("Error al cargar la lista de procesos.")
            console.error("[RecepcionCal CamionList] Error al cargar camiones:", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const resp = await fetchProcesos(
                    { estado: 'pendiente-recepcion', q: searchTerm, limit: 30, offset: 0 },
                    { signal: controller.signal }
                );
                setCamiones(resp.items || []);
                setError(null);
            } catch (e) {
                if (e?.name !== "AbortError") {
                    console.error("[RecepcionCal CamionList] Error al cargar camiones:", e);
                    // Solo muestra mensaje si no hay datos en pantalla
                    setError(prev => (camiones.length === 0 ? "Error al cargar la lista de procesos." : null));
                }
            } finally {
                setLoading(false);
            }
        }, 250);
        return () => { controller.abort(); clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    // Solo se ejecuta una vez al montar el componente

    const handleIniciarProceso = async (camion) => {
        const procesoId = camion?.id;
        if (!procesoId) {
            console.error("ID de proceso inválido:", procesoId)
            alert("No se pudo iniciar el proceso porque el ID no es válido.")
            return
        }
        try {
            // 1) reservar el proceso
            await lockProceso(procesoId);
            // 2) cargar y entrar
            const procesoSeleccionado = await getCamionById(procesoId);
            iniciarProceso(procesoSeleccionado);
        } catch (error) {
            // Si otro lo tiene, backend devuelve 423 con { detail.locked_by }
            if (error?.status === 423) {
                let holder = camion?.locked_by_name;
                try {
                    const { detail } = await error.json();
                    if (detail?.locked_by) holder = detail.locked_by;
                } catch { }
                alert(`No puedes abrir: en uso por ${holder || "otro usuario"}`);
                return;
            }
            console.error("Error al abrir el proceso:", error);
            alert("No se pudo abrir el proceso seleccionado.");
        }
    }

    // Función para determinar el estado del proceso y qué etapas están completadas
    const getProcesoStatus = (camion) => {
        // Preferir flags del backend (rápido y consistente)
        if (camion?.flags) {
            const f = camion.flags
            const etapas = {
                pesajeInicial: !!f.tiene_pesaje_inicial,
                inspeccionB: !!f.tiene_inspeccion_b,
                evacuacion: !!f.tiene_evacuacion,
                pesajeFinal: !!f.tiene_pesaje_final,
            }
            return { etapas, camion }
        }
        // Fallback legacy (si vinieran arrays embebidos)
        const etapas = { pesajeInicial: false, inspeccionB: false, evacuacion: false, pesajeFinal: false }
        if (Array.isArray(camion?.pesajes_registrados)) {
            camion.pesajes_registrados.forEach(p => {
                if (p.tipo === 'inicial') etapas.pesajeInicial = true
                if (p.tipo === 'final') etapas.pesajeFinal = true
            })
        }
        if (Array.isArray(camion?.inspecciones_realizadas)) {
            const b = camion.inspecciones_realizadas.some(i => i?.nombre_parte?.includes('B'))
            if (b) etapas.inspeccionB = true
        }
        if (camion?.evacuacion_registrada) etapas.evacuacion = true
        return { etapas, camion }
    }

    // Función para determinar qué acción mostrar según el estado (específico para recepcionista-cal)
    const getAccionProceso = (camion) => {
        const { etapas } = getProcesoStatus(camion)

        if (etapas.pesajeInicial && !etapas.inspeccionB) {
            return { tipo: 'continuar', texto: 'Realizar inspección', icono: <FaClipboardCheck /> }
        } else if (etapas.inspeccionB && !etapas.evacuacion) {
            return { tipo: 'continuar', texto: 'Evacuación', icono: <FaExclamationTriangle /> }
        } else if (etapas.evacuacion && !etapas.pesajeFinal) {
            return { tipo: 'completado', texto: 'Completado', icono: <FaCheck /> }
        } else if (!etapas.pesajeInicial) {
            return { tipo: 'esperando', texto: 'Esperando Pesaje', icono: <FaPause /> }
        } else {
            return { tipo: 'esperando', texto: 'Esperando Pesaje Final', icono: <FaPause /> }
        }
    }

    // Función para mostrar el progreso del proceso
    const getProgresoProceso = (camion) => {
        const { etapas } = getProcesoStatus(camion)
        const etapasCompletadas = Object.values(etapas).filter(Boolean).length
        const totalEtapas = 4
        const porcentaje = (etapasCompletadas / totalEtapas) * 100

        return {
            porcentaje,
            etapasCompletadas,
            totalEtapas,
            etapas
        }
    }
    const esPendienteRecepcionCal = (p) => {
        // 1) Con flags (preferido)
        if (p?.flags) {
            const f = p.flags
            return !!f.tiene_pesaje_inicial && !f.tiene_evacuacion && !f.tiene_pesaje_final
        }
        // 2) Si no hay flags, usar estado como pista
        if (p?.estado) return p.estado === 'pendiente-recepcion'
        // 3) Fallback legacy por arrays
        const tieneInicial = Array.isArray(p?.pesajes_registrados) && p.pesajes_registrados.some(x => x.tipo === 'inicial')
        const tieneFinal = Array.isArray(p?.pesajes_registrados) && p.pesajes_registrados.some(x => x.tipo === 'final')
        const tieneEvacuacion = !!p?.evacuacion_registrada
        return !!tieneInicial && !tieneEvacuacion && !tieneFinal
    }

    // Lógica de filtrado y ordenamiento - específica para recepcionista-cal
    const filteredCamiones = camiones.filter((camion) => {
        const matchSearch =
            camion.patente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            camion.nombre_chofer?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchEstado = esPendienteRecepcionCal(camion); // SIEMPRE pendientes
        return matchSearch && matchEstado;
    });

    const sortedCamiones = [...filteredCamiones].sort((a, b) => {
        const fieldA = a[sortBy] || 0
        const fieldB = b[sortBy] || 0

        if (sortBy.includes("fecha")) {
            return sortOrder === "asc" ? new Date(fieldA) - new Date(fieldB) : new Date(fieldB) - new Date(fieldA)
        }
        if (typeof fieldA === "string") {
            return sortOrder === "asc" ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA)
        }
        return sortOrder === "asc" ? fieldA - fieldB : fieldB - fieldA
    })

    // Función para formatear fecha de manera más compacta en móvil
    const formatFecha = (fechaISO) => {
        if (!fechaISO) return "No registrada";

        const fecha = new Date(fechaISO);

        // 1. Construimos la parte de la fecha manualmente para tener control total
        const dia = String(fecha.getDate()).padStart(2, '0');
        const mes = String(fecha.getMonth() + 1).padStart(2, '0'); // Se suma 1 porque los meses en JS van de 0-11
        const anio = fecha.getFullYear();
        const parteFecha = `${dia}/${mes}/${anio}`; // <-- Aquí forzamos el uso de las barras

        // 2. Formateamos la parte de la hora por separado para mantener el "p. m."
        const parteHora = fecha.toLocaleTimeString('es-CL', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${parteFecha} - ${parteHora}`;
    };

    return (
        <div className="recepcion-cal-container">
            <div className="list-header">
                <h1>Recepción Cal</h1>
                <p>Seleccione un proceso para realizar inspección y descarga de cal. Solo se muestran procesos con pesaje inicial completado.</p>
            </div>

            <div className="search-bar">
                <div className="search-input">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por patente o conductor"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                {loading && (
                    <span className="loading-badge" aria-live="polite" role="status">
                        <FaSpinner className="spin" />
                        <span>Consultando…</span>
                    </span>
                )}
            </div>

            {/* Error solo si no hay datos que mostrar */}
            {error && camiones.length === 0 && (
                <div className="error-container" role="alert" aria-live="polite">
                    <p className="error-message">{error}</p>
                </div>
            )}
            <div className="camion-list">

                {/* Header solo si no está cargando o ya hay datos en pantalla */}
                {(!loading || camiones.length > 0) && (
                    <div className="proceso-list-header">
                        {[
                            { key: "patente", label: "Patente", icon: <FaTruck /> },
                            { key: "patente_acoplado", label: "Patente Acoplado", icon: <TbTruckLoading /> },
                            { key: "nombre_chofer", label: "Conductor", icon: <FaUser /> },
                            { key: "peso_guia", label: "Peso Guía", icon: <FaWeight /> },
                            { key: "fecha_proceso", label: "Fecha", icon: <FaCalendarAlt /> },
                        ].map((header) => (
                            <div
                                key={header.key}
                                className={`header-cell ${sortBy === header.key ? "active" : ""}`}
                                onClick={() => handleSort(header.key)}
                            >
                                {header.icon}
                                <span>{header.label}</span>
                                {sortBy === header.key && (
                                    <span className="sort-indicator">
                                        {sortOrder === "asc" ? <FaArrowUp /> : <FaArrowDown />}
                                    </span>
                                )}
                            </div>
                        ))}
                        <div className="header-cell">Uso</div>
                        <div className="header-cell">Progreso</div>
                        <div className="header-cell">Acciones</div>
                    </div>
                )}

                {/* Contenido: skeleton inicial → sin resultados → filas reales */}
                {loading && camiones.length === 0 ? (
                    <>
                        {Array.from({ length: 5 }).map((_, i) => <ProcessSkeleton key={i} />)}
                    </>
                ) : sortedCamiones.length === 0 ? (
                    <div className="no-results">No se encontraron procesos.</div>
                ) : (
                    sortedCamiones.map((camion) => {
                        const progreso = getProgresoProceso(camion)
                        const accion = getAccionProceso(camion)
                        return (
                            <div key={camion.id} className="proceso-item">
                                <div className="proceso-cell" data-label="Patente">{camion.patente}</div>
                                <div className="proceso-cell" data-label="Acoplado">{camion.patente_acoplado || "—"}</div>
                                <div className="proceso-cell" data-label="Conductor">{camion.nombre_chofer || "N/A"}</div>
                                <div className="proceso-cell" data-label="Peso Guía">{camion.peso_guia ? `${camion.peso_guia} kg` : "N/A"}</div>
                                <div className="proceso-cell" data-label="Fecha">{formatFecha(camion.fecha_proceso)}</div>
                                <div className="proceso-cell" data-label="Uso">
                                    <LockPill state={camion.lock_state || (camion.locked_by ? "tomado" : "disponible")} holder={camion.locked_by_name} />
                                </div>
                                <div className="proceso-cell" data-label="Progreso">
                                    <div className="progreso-container">
                                        <div className="progreso-bar">
                                            <div className="progreso-fill" style={{ width: `${progreso.porcentaje}%` }}></div>
                                        </div>
                                        <span className="progreso-text">{progreso.etapasCompletadas}/{progreso.totalEtapas}</span>
                                    </div>
                                </div>
                                <div className="proceso-cell">
                                    {accion.tipo === 'continuar' ? (
                                        <button className="btn-secondary" onClick={() => handleIniciarProceso(camion)}>
                                            {accion.icono}
                                            {accion.texto}
                                        </button>
                                    ) : (
                                        <div className={`estado-${accion.tipo}`}>
                                            {accion.icono}
                                            {accion.texto}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
} 