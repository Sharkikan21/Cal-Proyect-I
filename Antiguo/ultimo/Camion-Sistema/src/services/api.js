// api.js - Versión con debug mejorado

import { supabase } from '../lib/supabaseClient';
export const API_BASE_URL =
    (typeof window !== 'undefined' && (window.env?.API_BASE_URL || window.env?.BASE_URL)) || // Electron preload
    (import.meta?.env?.VITE_API_BASE_URL) ||                      // .env en dev
    'http://127.0.0.1:8123';
console.log('API_BASE_URL configurada:', API_BASE_URL);

export const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
        'Content-Type': 'application/json',
        //'ngrok-skip-browser-warning': 'true'
    };
    if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
};
export const authHeaders = getAuthHeaders;
export const apiCall = async (endpoint, method = "GET", body = null, opts = {}) => {
    try {
        const headers = await getAuthHeaders();
        const fullUrl = `${API_BASE_URL}${endpoint}`;

        const fetchOpts = {
            method,
            headers,
            keepalive: !!opts.keepalive,
            signal: opts.signal,
        };
        if (body) fetchOpts.body = JSON.stringify(body);

        const res = await fetch(fullUrl, fetchOpts);

        if (!res.ok) {
            // intenta extraer mensaje útil
            let message = `HTTP ${res.status}`;
            const text = await res.text().catch(() => "");
            try {
                const json = text ? JSON.parse(text) : null;
                if (Array.isArray(json?.detail)) {
                    const msgs = json.detail.map(d =>
                        typeof d === "string" ? d :
                            `${d.msg}${Array.isArray(d.loc) ? ` (${d.loc.join(".")})` : d.loc ? ` (${d.loc})` : ""}`
                    ).join(" | ");
                    message += `: ${msgs}`;
                } else if (json?.detail) {
                    message += `: ${typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)}`;
                } else if (json?.message) {
                    message += `: ${json.message}`;
                } else if (text) {
                    message += `: ${text}`;
                }
            } catch {
                if (text) message += `: ${text}`;
            }
            const err = new Error(message);
            err.status = res.status;
            if (opts.silent) return null;
            throw err;
        }

        // Evita fallar con 204 / cuerpo vacío
        if (res.status === 204) return null;
        const txt = await res.text();
        return txt ? JSON.parse(txt) : null;
    } catch (error) {
        if (error?.name === "AbortError") {
            if (opts.silent) return null;
            throw error;
        }
        if (opts.silent) return null;
        console.error("Error en la llamada a la API:", error?.message || error);
        throw error;
    }
};


// fetchProcesos pasa el signal hacia abajo
export const fetchProcesos = async ({ estado, q, limit = 30, offset = 0 } = {}, opts = {}) => {
    const qs = new URLSearchParams();
    if (estado) qs.set('estado', estado);
    if (q) qs.set('q', q);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return apiCall(`/api/procesos?${qs.toString()}`, "GET", null, opts);
};

const isUUID = (v) =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function lockProceso(id) {
    if (!isUUID(id)) {
        console.debug("[lockProceso] id inválido, se omite:", id);
        return { skipped: true };
    }
    return apiCall(`/api/procesos/${id}/lock`, "POST");
}

export async function unlockProceso(id) {
    if (!isUUID(id)) {
        console.debug("[unlockProceso] id inválido, se omite:", id);
        return { skipped: true };
    }
    return apiCall(`/api/procesos/${id}/unlock`, "POST");
}

export async function heartbeatProceso(id, opts = {}) {
    if (!isUUID(id)) {
        console.debug("[heartbeatProceso] id inválido, se omite:", id);
        return { skipped: true };
    }
    return apiCall(`/api/procesos/${id}/heartbeat`, "POST", null, opts);
}


export const enviarAlertaCal = (payload) =>
    apiCall("/alerta-cal", "POST", payload);

export const getCamionById = (procesoId) => apiCall(`/api/procesos/${procesoId}`);

export const guardarInspeccion = (data) => apiCall('/api/inspecciones', 'POST', data);

export const guardarInspeccionB = (data) => apiCall('/api/inspeccionB', 'POST', data);

export const guardarPesajeInicial = (data) => apiCall('/api/pesajes', 'POST', data);

export const guardarPesajeFinal = (data) => apiCall('/api/pesaje_final_con_estado', 'POST', data);

export const registrarEvacuacion = (data) => apiCall('/api/evacuaciones', 'POST', data);

export const logActivity = (tipo_actividad, metadata) => {
    return apiCall('/api/actividad', 'POST', {
        tipo_actividad,
        metadata
    });
};

export const finalizarProcesoCompleto = (procesoId, data) => apiCall(`/api/procesos/${procesoId}/finalizar`, 'POST', data);

export const limpiarProcesosAbandonados = () => apiCall('/api/admin/limpiar-procesos-abandonados', 'POST');

export const fetchActivityLogs = () => apiCall('/api/logs');