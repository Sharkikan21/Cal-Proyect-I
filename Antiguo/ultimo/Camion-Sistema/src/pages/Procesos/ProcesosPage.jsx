// src/pages/Procesos/ProcesosPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { fetchProcesos } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/ProcesosPage.css";

const STORAGE_KEY = "procesos_prefs_v1";

const ESTADOS = [
    { key: "todos", label: "Todos" },
    { key: "pendiente-recepcion", label: "Pendiente Recepción" },
    { key: "pendiente-pesaje-final", label: "Pendiente Tara" },
    { key: "finalizado", label: "Finalizados" },
];

function estadoCalculado(p) {
    if (p?.flags) {
        const f = p.flags;
        if (f.tiene_pesaje_final) return "finalizado";
        if (f.tiene_pesaje_inicial && f.tiene_evacuacion && !f.tiene_pesaje_final)
            return "pendiente-pesaje-final";
        if (f.tiene_pesaje_inicial && !f.tiene_evacuacion)
            return "pendiente-recepcion";
        return "nuevo";
    }
    if (p?.estado) return p.estado;
    const tieneInicial =
        Array.isArray(p?.pesajes_registrados) &&
        p.pesajes_registrados.some((x) => x.tipo === "inicial");
    const tieneFinal =
        Array.isArray(p?.pesajes_registrados) &&
        p.pesajes_registrados.some((x) => x.tipo === "final");
    const tieneEvac = !!p?.evacuacion_registrada;
    if (tieneFinal) return "finalizado";
    if (tieneInicial && tieneEvac && !tieneFinal) return "pendiente-pesaje-final";
    if (tieneInicial && !tieneEvac) return "pendiente-recepcion";
    return "nuevo";
}

function formatFecha(fechaISO) {
    if (!fechaISO) return "";
    return new Date(fechaISO).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
function formatFechaCorta(fechaISO) {
    if (!fechaISO) return "";
    return new Date(fechaISO).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
        .replace(",", "");
}


function toCSV(rows) {
    const headers = [
        "Patente",
        "Acoplado",
        "Conductor",
        "Peso Guía",
        "Bruto Báscula",
        "Tara Final",
        "Evac. (min)",
        "Obs. Evacuación",
        "Mangueras",
        "Oper. Inicial",
        "Oper. Recepción Cal",
        "Oper. Final",
        "Fecha",
        "Estado",
    ];

    const lines = rows.map((p) => {
        const est = estadoCalculado(p);
        const fecha = p?.fecha_proceso ? formatFecha(p.fecha_proceso) : "";
        const ex = p?.extras || {};
        const ops = ex.operadores || {};

        const vals = [
            p?.patente || "",
            p?.patente_acoplado || "",
            p?.nombre_chofer || "",
            p?.peso_guia != null ? String(p.peso_guia) : "",
            ex.pesaje_inicial_kg ?? "",
            ex.pesaje_final_kg ?? "",
            ex.evac_tiempo_minutos ?? "",
            ex.evac_observaciones ? String(ex.evac_observaciones) : "",
            Array.isArray(ex.mangueras_usadas) ? ex.mangueras_usadas.join(" | ") : "",
            ops.pesaje_inicial?.email || "",
            ops.recepcion_cal?.email || "",
            ops.pesaje_final?.email || "",
            fecha,
            est,
        ];

        return vals.map((v) => `"${String(v).replaceAll(`"`, `""`)}"`).join(",");
    });

    return [headers.join(","), ...lines].join("\n");
}

export default function ProcesosPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [estadoSel, setEstadoSel] = useState("todos");
    const [ordenDesc, setOrdenDesc] = useState(true);
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [hasMore, setHasMore] = useState(false);
    const hasNext = hasMore;

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const prefs = JSON.parse(raw);
            if (prefs.estadoSel) setEstadoSel(prefs.estadoSel);
            if (typeof prefs.ordenDesc === "boolean") setOrdenDesc(prefs.ordenDesc);
            if (typeof prefs.pageSize === "number") setPageSize(prefs.pageSize);
            if (typeof prefs.search === "string") setSearch(prefs.search);
        } catch { }
    }, []);
    useEffect(() => {
        const prefs = { estadoSel, ordenDesc, pageSize, search };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }, [estadoSel, ordenDesc, pageSize, search]);
    useEffect(() => { setPage(1); }, [estadoSel, search, ordenDesc, pageSize]);
    useEffect(() => {
        if (user?.rol !== "admin") {
            navigate("/", { replace: true });
            return;
        }

        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const estadoParam = estadoSel === "todos" ? undefined : estadoSel;
                const resp = await fetchProcesos({
                    estado: estadoParam,
                    q: search,
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                });
                const items = Array.isArray(resp?.items) ? resp.items : [];
                setLista(items);
                setHasMore(resp?.has_more ?? items.length === pageSize);
            } catch (e) {
                console.error("Error cargando procesos:", e);
                setLista([]);
                setHasMore(false);
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(t);
    }, [user?.rol, navigate, estadoSel, search, page, pageSize]);

    const filas = useMemo(() => {
        const cop = [...lista];
        cop.sort((a, b) => {
            const da = new Date(a?.fecha_proceso || 0).getTime();
            const db = new Date(b?.fecha_proceso || 0).getTime();
            return ordenDesc ? db - da : da - db;
        });
        return cop;
    }, [lista, ordenDesc]);

    const handlePrev = useCallback(() => {
        setPage((p) => Math.max(1, p - 1));
    }, []);

    const handleNext = useCallback(() => {
        if (hasMore) setPage((p) => p + 1);
    }, [hasMore]);

    const handleExportCSV = useCallback(async () => {
        try {
            const CHUNK = 200;
            const estadoParam = estadoSel === "todos" ? undefined : estadoSel;
            let offset = 0;
            let all = [];
            while (true) {
                const resp = await fetchProcesos({
                    estado: estadoParam,
                    q: search,
                    limit: CHUNK,
                    offset,
                });

                const items = resp?.items || [];
                all = all.concat(items);
                if (items.length < CHUNK) break;
                offset += items.length;
            }

            if (all.length === 0) {
                alert("No hay datos para exportar con los filtros actuales.");
                return;
            }

            const csv = toCSV(all);
            const BOM = "\uFEFF";
            const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `procesos_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            try {
                const txt = await e.response?.text?.();
                console.error("Export error:", txt || e);
            } catch {
                console.error("Export error:", e);
            }
            alert("No se pudo exportar el CSV");
        }
    }, [estadoSel, search]);


    const badgeClass = (est) =>
        est === "pendiente-recepcion" ? "estado-badge estado-pend" :
            est === "pendiente-pesaje-final" ? "estado-badge estado-tara" :
                est === "finalizado" ? "estado-badge estado-fin" :
                    "estado-badge estado-nvo";

    return (
        <div className="procesos-container">
            <h1 className="page-title">Todos los procesos</h1>
            <p className="page-subtitle">
                Catálogo general. Puedes buscar y abrir el detalle de cada proceso.
            </p>

            <div className="filters">
                <div className="search-input">
                    <FaSearch className="icon" />
                    <input
                        placeholder="Buscar por patente, conductor o acoplado…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="segmented">
                    {ESTADOS.map((e) => (
                        <button
                            key={e.key}
                            className={estadoSel === e.key ? "active" : ""}
                            onClick={() => setEstadoSel(e.key)}
                        >
                            {e.label}
                        </button>
                    ))}
                </div>

                <button className="sort-btn" onClick={() => setOrdenDesc((v) => !v)}>
                    Fecha {ordenDesc ? "↓" : "↑"}
                </button>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="col-patente">Patente</th>
                            <th className="col-acoplado">Acoplado</th>
                            <th className="col-conductor">Conductor</th>
                            <th className="col-peso">Peso Guía</th>
                            <th className="col-fecha">Fecha</th>
                            <th className="col-estado">Estado</th>
                            <th className="actions-col">Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: "1rem" }}>Cargando…</td></tr>
                        ) : filas.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: "1rem" }}>Sin resultados</td></tr>
                        ) : (
                            filas.map((p) => {
                                const est = estadoCalculado(p);
                                return (
                                    <tr key={p.id}>
                                        <td className="col-patente font-medium">{p.patente}</td>
                                        <td className="col-acoplado">{p.patente_acoplado || "—"}</td>
                                        <td className="col-conductor">{p.nombre_chofer || "—"}</td>
                                        <td className="col-peso">{p.peso_guia != null ? `${p.peso_guia} kg` : "—"}</td>
                                        <td className="col-fecha">
                                            <span className="fecha-lg">{formatFecha(p.fecha_proceso)}</span>
                                            <span className="fecha-sm">{formatFechaCorta(p.fecha_proceso)}</span>
                                        </td>

                                        <td className="col-estado">
                                            <span className={badgeClass(est)}>
                                                {est === "pendiente-recepcion" ? "Pend. Recepción" :
                                                    est === "pendiente-pesaje-final" ? "Pend. Tara" :
                                                        est === "finalizado" ? "Finalizado" : "Nuevo"}
                                            </span>
                                        </td>
                                        <td className="actions-col">
                                            <Link to={`/proceso/${p.id}/detalles`} className="btn-secondary">
                                                Ver Detalles
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                </table>
            </div>

            <div className="pager">
                <button
                    className="btn-secondary pager-prev"
                    disabled={page === 1}
                    onClick={handlePrev}
                >
                    ← Anterior
                </button>

                <button
                    className="btn-secondary pager-next"
                    disabled={!hasNext}
                    onClick={handleNext}
                >
                    Siguiente →
                </button>

                <div className="pager-info">
                    Página {page} • Mostrando {filas.length} filas
                </div>

                <div className="pager-size">
                    <label>Filas por página</label>
                    <select
                        value={pageSize}
                        onChange={e => setPageSize(Number(e.target.value))}
                    >
                        {[5, 10, 20, 50].map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>

                <button className="btn-secondary pager-export" onClick={handleExportCSV}>
                    Exportar CSV
                </button>
            </div>
        </div>

    );
}
