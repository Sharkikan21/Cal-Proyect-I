"use client"

// Ubicación: src/pages/Pesaje/components/CamionList.jsx

import { useState, useEffect, useCallback } from "react"
import { useProcesoCamion } from "../../../context/ProcesoCamionContext"
import { useAuth } from "../../../context/AuthContext"
import { fetchProcesos, getCamionById, lockProceso } from "../../../services/api"
import {
  FaTruck, FaUser, FaWeight, FaCalendarAlt, FaSearch,
  FaCheck, FaInfoCircle, FaArrowDown, FaArrowUp,
  FaClipboardCheck, FaExclamationTriangle, FaPlay, FaPause,
  FaSpinner
} from "react-icons/fa";
import { TbTruckLoading } from "react-icons/tb"
import { Link } from "react-router-dom"
import "../../../styles/CamionList.css"

// Pill visual para el estado de uso (sin CSS global)
const LockPill = ({ state, holder }) => {
  const taken = state === "tomado";
  const bg = taken ? "#fff7ed" : "#ecfdf5";
  const color = taken ? "#9a3412" : "#065f46";
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


const RCSkeletonRow = () => (
  <div className="rc-skeleton-row">
    <div className="rc-skel short"></div>
    <div className="rc-skel short"></div>
    <div className="rc-skel long"></div>
    <div className="rc-skel short"></div>
    <div className="rc-skel medium"></div>
    <div className="rc-skel pill"></div>
    <div className="rc-skel progress"></div>
    <div className="rc-skel button"></div>
  </div>
);


export default function CamionList() {
  const [camiones, setCamiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("fecha_proceso")
  const [sortOrder, setSortOrder] = useState("desc")
  const [vista, setVista] = useState("pendientes")
  const { iniciarProceso } = useProcesoCamion()

  const handleSort = (key) => {
    const newOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc"
    setSortBy(key)
    setSortOrder(newOrder)
  }

  const getCamiones = async () => {
    try {
      setLoading(true)
      console.log("[Pesaje CamionList] Cargando camiones...")
      const resp = await fetchProcesos({ estado: 'pendiente-pesaje-final', q: searchTerm });
      setCamiones(resp.items || []);

      setError(null)
    } catch (err) {
      setError("Error al cargar la lista de procesos.")
      console.error("[Pesaje CamionList] Error al cargar camiones:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        setLoading(true);
        try {
          const estado =
            vista === 'finalizados'     // tu pestaña "Tara"
              ? 'pendiente-pesaje-final'
              : undefined;              // "Bruto" → traemos no finalizados (lo filtramos con flags)
          const resp = await fetchProcesos({ estado, q: searchTerm });
          setCamiones(resp.items || []);
          setError(null);
        } catch (e) {
          setError("Error al cargar la lista de procesos.");
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm, vista]);
  // Solo se ejecuta una vez al montar el componente

  const handleIniciarProceso = async (camion) => {
    const procesoId = camion?.id;
    if (!procesoId) {
      console.error("ID de proceso inválido:", procesoId)
      alert("No se pudo iniciar el proceso porque el ID no es válido.")
      return
    }
    try {
      await lockProceso(procesoId);
      const procesoSeleccionado = await getCamionById(procesoId)
      iniciarProceso(procesoSeleccionado)
    } catch (error) {
      // Si otro lo tiene, backend devuelve 423 con {detail.locked_by}
      if (error?.status === 423) {
        try {
          const { detail } = await error.json();
          alert(`No puedes abrir: en uso por ${detail?.locked_by || camion?.locked_by_name || "otro usuario"}`);
        } catch { alert("No puedes abrir: el proceso está en uso."); }
        return;
      }
      console.error("Error al abrir el proceso:", error)
      alert("No se pudo abrir el proceso seleccionado.")
    }
  }

  // Función para determinar el estado del proceso y qué etapas están completadas
  const getProcesoStatus = (camion) => {
    if (camion?.flags) {
      const f = camion.flags;
      return {
        etapas: {
          pesajeInicial: !!f.tiene_pesaje_inicial,
          inspeccionB: !!f.tiene_inspeccion_b,
          evacuacion: !!f.tiene_evacuacion,
          pesajeFinal: !!f.tiene_pesaje_final,
        },
        camion
      }
    }
    // Fallback legacy por si vienes desde /api/camiones
    const etapas = { pesajeInicial: false, inspeccionB: false, evacuacion: false, pesajeFinal: false };
    if (Array.isArray(camion?.pesajes_registrados)) {
      camion.pesajes_registrados.forEach(p => {
        if (p.tipo === 'inicial') etapas.pesajeInicial = true;
        if (p.tipo === 'final') etapas.pesajeFinal = true;
      });
    }
    if (Array.isArray(camion?.inspecciones_realizadas)) {
      if (camion.inspecciones_realizadas.some(i => i?.nombre_parte?.includes('B'))) etapas.inspeccionB = true;
    }
    if (camion?.evacuacion_registrada) etapas.evacuacion = true;
    return { etapas, camion };
  }
  // Función para determinar qué acción mostrar según el rol y estado
  const getAccionProceso = (camion) => {
    const { etapas } = getProcesoStatus(camion)

    if (user?.rol === 'pesaje') {
      if (!etapas.pesajeInicial) {
        return { tipo: 'iniciar', texto: 'Pesaje Bruto', icono: <FaWeight /> }
      } else if (etapas.inspeccionB && etapas.evacuacion && !etapas.pesajeFinal) {
        return { tipo: 'continuar', texto: 'Pesaje Tara', icono: <FaTruck /> }
      } else if (etapas.pesajeInicial && !etapas.inspeccionB) {
        return { tipo: 'esperando', texto: 'Esperando Recepción Cal', icono: <FaPause /> }
      } else if (etapas.inspeccionB && !etapas.evacuacion) {
        return { tipo: 'esperando', texto: 'Esperando Evacuación', icono: <FaPause /> }
      } else {
        return { tipo: 'esperando', texto: 'Esperando Recepción Cal', icono: <FaPause /> }
      }
    } else if (user?.rol === 'recepcionista-cal') {
      if (etapas.pesajeInicial && !etapas.inspeccionB) {
        return { tipo: 'continuar', texto: 'Inspección B', icono: <FaClipboardCheck /> }
      } else if (etapas.inspeccionB && !etapas.evacuacion) {
        return { tipo: 'continuar', texto: 'Evacuación', icono: <FaExclamationTriangle /> }
      } else if (etapas.evacuacion && !etapas.pesajeFinal) {
        return { tipo: 'completado', texto: 'Completado', icono: <FaCheck /> }
      } else {
        return { tipo: 'esperando', texto: 'Esperando Pesaje', icono: <FaPause /> }
      }
    } else if (user?.rol === 'admin') {
      if (!etapas.pesajeInicial) {
        return { tipo: 'iniciar', texto: 'Iniciar Proceso', icono: <FaPlay /> }
      } else if (!etapas.pesajeFinal) {
        return { tipo: 'continuar', texto: 'Iniciar Pesaje', icono: <FaPlay /> }
      } else {
        return { tipo: 'completado', texto: 'Completado', icono: <FaCheck /> }
      }
    }

    return { tipo: 'iniciar', texto: 'Iniciar Proceso', icono: <FaPlay /> }
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

  // Lógica de filtrado y ordenamiento - específica para pesaje
  const filteredCamiones = camiones.filter((camion) => {
    const matchSearch =
      camion.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (camion.nombre_chofer && camion.nombre_chofer.toLowerCase().includes(searchTerm.toLowerCase()))

    const { etapas } = getProcesoStatus(camion);
    const matchEstado = vista === "pendientes"
      ? (!etapas.pesajeFinal && !etapas.pesajeInicial) // Bruto
      : (etapas.pesajeInicial && etapas.inspeccionB && etapas.evacuacion && !etapas.pesajeFinal); // Tara

    return matchSearch && matchEstado
  })


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
  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "No registrada";
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const parteFecha = `${dia}/${mes}/${anio}`;
    const parteHora = fecha.toLocaleTimeString('es-CL', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // 3. Unimos todo para tener el formato final deseado
    return `${parteFecha} - ${parteHora}`;
  };

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
      </div>
    )
  }

  return (
    <div className="camion-list-container">
      <div className="list-header">
        <h1>Sistema de Pesaje</h1>
        <p>Seleccione un proceso para realizar pesaje bruto o tara según corresponda.</p>
      </div>

      <div className="search-bar">
        <div className="search-input">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por patente o conductor"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {loading && (
          <span className="loading-badge" aria-live="polite" role="status" title="Consultando…">
            <FaSpinner className="spin" />
            <span>Consultando…</span>
          </span>
        )}
      </div>

      <div className="tab-toggle">
        <button
          className={vista === "pendientes" ? "tab active" : "tab"}
          onClick={() => { setVista("pendientes"); }}
        >
          <span>Bruto</span>
        </button>

        <button
          className={vista === "finalizados" ? "tab active" : "tab"}
          onClick={() => {
            setCamiones([]);
            setVista("finalizados");
          }}
        >
          <span>Tara</span>
        </button>
      </div>

      {loading && camiones.length === 0 ? (
        <div className="camion-list">
          <div className="camion-list-header">
            {[
              { key: "patente", label: "Patente", icon: <FaTruck /> },
              { key: "patente_acoplado", label: "Acoplado", icon: <TbTruckLoading /> },
              { key: "nombre_chofer", label: "Conductor", icon: <FaUser /> },
              { key: "peso_guia", label: "Peso Guía", icon: <FaWeight /> },
              { key: "fecha_proceso", label: "Fecha", icon: <FaCalendarAlt /> },
            ].map((header) => (
              <div key={header.key} className="header-cell">
                {header.icon}
                <span>{header.label}</span>
              </div>
            ))}
            <div className="header-cell">Uso</div>
            <div className="header-cell">Progreso</div>
            <div className="header-cell actions-cell">Acciones</div>
          </div>

          {Array.from({ length: 6 }).map((_, i) => <RCSkeletonRow key={i} />)}
        </div>
      ) : sortedCamiones.length === 0 ? (
        <div className="no-results">
          <p>
            {vista === "pendientes"
              ? "No hay procesos pendientes de pesaje bruto."
              : "No hay procesos listos para pesaje tara."
            }
          </p>
        </div>
      ) : (
        <div className="camion-list">
          <div className="camion-list-header">
            {[
              { key: "patente", label: "Patente", icon: <FaTruck /> },
              { key: "patente_acoplado", label: "Acoplado", icon: <TbTruckLoading /> },
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
            <div className="header-cell actions-cell">Acciones</div>
          </div>

          {/* Items reales (tu map existente) */}
          {sortedCamiones.map((camion) => {
            const progreso = getProgresoProceso(camion)
            const accion = getAccionProceso(camion)
            return (
              <div key={camion.id} className="camion-item">
                <div className="camion-cell" data-label="Patente">{camion.patente}</div>
                <div className="camion-cell" data-label="Acoplado">{camion.patente_acoplado || "—"}</div>
                <div className="camion-cell" data-label="Conductor">{camion.nombre_chofer || "N/A"}</div>
                <div className="camion-cell" data-label="Peso Guía">{camion.peso_guia ? `${camion.peso_guia} kg` : "N/A"}</div>
                <div className="camion-cell" data-label="Fecha">{formatFecha(camion.fecha_proceso)}</div>
                <div className="camion-cell" data-label="Uso">
                  <LockPill state={camion.lock_state || (camion.locked_by ? "tomado" : "disponible")} holder={camion.locked_by_name} />
                </div>
                <div className="camion-cell" data-label="Progreso">
                  <div className="progreso-container">
                    <div className="progreso-bar">
                      <div className="progreso-fill" style={{ width: `${progreso.porcentaje}%` }}></div>
                    </div>
                    <span className="progreso-text">{progreso.etapasCompletadas}/{progreso.totalEtapas}</span>
                  </div>
                </div>
                <div className="camion-cell">
                  {vista === "pendientes" ? (
                    (accion.tipo === 'iniciar' || accion.tipo === 'continuar') ? (
                      <button
                        className={`btn-${accion.tipo === 'iniciar' ? 'primary' : 'secondary'}`}
                        onClick={() => handleIniciarProceso(camion)}
                      >
                        {accion.icono}
                        {accion.texto}
                      </button>
                    ) : (
                      <div className={`estado-${accion.tipo}`}>{accion.icono}{accion.texto}</div>
                    )
                  ) : (
                    (accion.tipo === 'continuar'
                      ? <button className="btn-secondary" onClick={() => handleIniciarProceso(camion)}>{accion.icono}{accion.texto}</button>
                      : <Link to={`/proceso/${camion.id}/detalles`} className="btn-secondary">Ver Detalles</Link>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
