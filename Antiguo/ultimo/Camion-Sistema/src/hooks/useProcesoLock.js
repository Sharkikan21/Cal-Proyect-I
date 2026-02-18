import { useEffect, useRef, useState } from "react";
import {
    lockProceso,
    unlockProceso,
    heartbeatProceso,
    API_BASE_URL as API_BASE_URL_FROM_API,
    getAuthHeaders
} from "../services/api";

// ---- helpers ----
const isElectron = !!(window.env && window.env.IS_ELECTRON);
const isSecure = location.protocol === "https:";
const API_BASE =
    (window.env && window.env.API_BASE_URL) ||
    API_BASE_URL_FROM_API ||
    import.meta.env?.VITE_API_BASE_URL ||
    `${location.origin}`;

// UUID v1–v5
const isUUID = (v) =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export function useProcesoLock(procesoId) {
    const [hasLock, setHasLock] = useState(false);
    const [holder, setHolder] = useState(null);
    const hb = useRef(null);
    const pausedRef = useRef(false);
    const pauseLock = () => {
        pausedRef.current = true;
        stopHB(); // por si ya estaba corriendo
    };

    const startHB = () => {
        stopHB();
        hb.current = setInterval(async () => {
            if (pausedRef.current) return;          //  pausa
            if (!isUUID(procesoId)) return;

            try {
                await heartbeatProceso(procesoId, { silent: true });
                // ok
            } catch (e) {
                if (e?.status === 409 || e?.status === 401) {
                    // evita spam y marca que ya no tenemos lock
                    stopHB();
                    setHasLock(false);
                    setHolder("otro usuario");
                } else {
                    // otros errores sí se loguean
                    console.warn("heartbeat best-effort:", e);
                }
            }
        }, 15_000);
    };

    const stopHB = () => {
        if (hb.current) { clearInterval(hb.current); hb.current = null; }
    };

    const resumeLock = async () => {
        pausedRef.current = false;   // 🔔 reanudar
        if (!isUUID(procesoId)) return false;
        try {
            await heartbeatProceso(procesoId);
            setHasLock(true);
            setHolder(null);
            startHB();
            return true;
        } catch {
            setHasLock(false);
            return false;
        }
    };

    const takeLock = async () => {
        if (!isUUID(procesoId)) return false;
        try {
            await lockProceso(procesoId);
            setHasLock(true);
            setHolder(null);
            startHB();
            return true;
        } catch (err) {
            // Si tu api() lanza Error y no Response, evita .json(); solo marca que no se pudo
            setHasLock(false);
            setHolder("otro usuario");
            return false;
        }
    };

    const releaseLock = async (viaBeacon = false) => {
        stopHB();

        // 🔒 No intentes liberar si no hay id válido o si no tenías lock
        if (!isUUID(procesoId) || !hasLock) {
            setHasLock(false);
            setHolder(null);
            return;
        }

        const absoluteUrl = `${API_BASE}/api/procesos/${procesoId}/unlock`;
        const emptyBody = JSON.stringify({});

        try {
            if (viaBeacon && isSecure && !isElectron && "sendBeacon" in navigator) {
                // OJO: sendBeacon no envía Authorization: Bearer; úsalo solo si usas cookie
                const blob = new Blob([emptyBody], { type: "application/json" });
                navigator.sendBeacon(absoluteUrl, blob);
            } else {
                const headers = await getAuthHeaders();
                await fetch(absoluteUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...headers },
                    credentials: "include",
                    keepalive: true,
                    body: emptyBody
                });
                // Alternativa: await unlockProceso(procesoId); (tu wrapper ya valida UUID)
            }
        } catch (e) {
            console.warn("releaseLock best-effort failed:", e);
        } finally {
            setHasLock(false);
            setHolder(null);
        }
    };

    useEffect(() => {
        if (!isUUID(procesoId)) return;

        const onUnload = () => releaseLock(false);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            window.removeEventListener("beforeunload", onUnload);
            releaseLock(false);
        };
    }, [procesoId]);

    return { hasLock, holder, takeLock, releaseLock, resumeLock, pauseLock };
}
