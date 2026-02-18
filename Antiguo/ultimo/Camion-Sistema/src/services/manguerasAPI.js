// services/manguerasApi.js

// 1. Importamos el cliente de Supabase en lugar del apiClient genérico
import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';
import { apiCall } from './api';

const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 'Content-Type': 'application/json' };
    if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
};

export const manguerasApi = {
    // Obtiene las mangueras asociadas a un proceso específico
    async obtenerManguerasPorCamion(procesoId) {
        if (!procesoId) return [];

        // La consulta se ejecuta con 'await', no necesita .execute()
        const { data, error } = await supabase
            .from('vista_mangueras_completa')
            .select('*')
            .eq('proceso_id', procesoId); // <-- Así, sin .execute()

        if (error) {
            console.error("Error definitivo al obtener mangueras:", error);
            throw error;
        }

        return data;
    },

    // Obtiene los detalles de una sola manguera por su ID
    async obtenerMangueraPorId(mangueraId) {
        const { data, error } = await supabase
            .from('vista_mangueras_completa')
            .select('*')
            .eq('id', mangueraId)
            .single();
        if (error) throw error;
        return data;
    },

    // Actualiza las horas de uso y observaciones de una manguera
    async actualizarHorasUso(mangueraId, horasUso, observaciones = '') {
        const { data, error } = await supabase
            .from('mangueras')
            .update({ horas_uso_actual: horasUso, observaciones })
            .eq('id', mangueraId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async registrarUsoManguera(mangueraId, procesoId, horasOperacion) {
        const { data, error } = await supabase.rpc('registrar_y_actualizar_uso', {
            'manguera_uuid': mangueraId,
            'horas_a_sumar': horasOperacion,
            'proceso_uuid': procesoId,
            'usuario_uuid': (await supabase.auth.getUser()).data.user.id
        });
        if (error) throw error;
        return data;
    },

    async obtenerTodasLasMangueras() {
        const { data, error } = await supabase
            .from('vista_mangueras_completa')
            .select('*')
            .order('fecha_ingreso', { ascending: false });
        if (error) throw error;
        return data;
    },

    async crearManguera(datosNuevaManguera) {
        const { data, error } = await supabase
            .from('mangueras')
            .insert(datosNuevaManguera)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async actualizarManguera(mangueraId, datosActualizados) {
        console.log(`[API] Actualizando manguera ${mangueraId} vía backend Python...`);
        // reutiliza baseURL + bearer + manejo de errores
        await apiCall(`/api/admin/mangueras/${mangueraId}`, 'PUT', datosActualizados);
        return { ok: true };
    },
    async liberarManguerasPorProceso(procesoId) {
        if (!procesoId) {
            console.warn("No se proporcionó un ID de proceso para liberar mangueras.");
            return;
        }
        console.log(`Liberando mangueras para el proceso finalizado: ${procesoId}`);
        const { data, error } = await supabase
            .from('mangueras')
            .update({ proceso_id: null })
            .eq('proceso_id', procesoId)
            .select(); // <-- AÑADIDO

        if (error) {
            console.error("Error al liberar mangueras:", error);
            throw error;
        }
        console.log("Mangueras liberadas con éxito:", data);
        return data;
    },

    async retirarManguera(mangueraId, motivo) {
        const { data, error } = await supabase
            .from('mangueras')
            .update({ estado: 'retirada', observaciones: motivo })
            .eq('id', mangueraId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
    async obtenerManguerasDisponibles() {
        const { data, error } = await supabase
            .from('vista_mangueras_completa')
            .select('*')
            .is('proceso_id', null); // <-- La clave: trae solo las que no tienen proceso_id

        if (error) {
            console.error("Error obteniendo mangueras disponibles:", error);
            throw error;
        }
        return data;
    },
};

// --- Hook y Utilidad (sin cambios) ---

export const useMangueras = (procesoId) => {
    const [mangueras, setMangueras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const cargarMangueras = async () => {
            if (!procesoId) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const data = await manguerasApi.obtenerManguerasPorCamion(procesoId);
                setMangueras(data);
            } catch (err) {
                console.error("DETALLE DEL ERROR DE SUPABASE:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };
        cargarMangueras();
    }, [procesoId]);

    return { mangueras, loading, error, refetch: () => cargarMangueras() };
};

export const obtenerEstadoManguera = (horasUso, vidaUtilHoras) => {
    if (vidaUtilHoras <= 0) {
        // Cambiamos 'mensaje' por 'texto'
        return { nivel: 'normal', texto: 'N/A', color: 'gray', permitirUso: true };
    }
    const porcentajeUso = (horasUso / vidaUtilHoras) * 100;

    if (porcentajeUso >= 90) {
        // Cambiamos 'mensaje' por 'texto'
        return { nivel: 'critico', texto: 'Crítico', color: 'red', permitirUso: false };
    } else if (porcentajeUso >= 80) {
        // Cambiamos 'mensaje' por 'texto'
        return { nivel: 'alerta', texto: 'Alerta', color: 'orange', permitirUso: true };
    } else {
        // Cambiamos 'mensaje' por 'texto'
        return { nivel: 'normal', texto: 'Óptimo', color: 'green', permitirUso: true };
    }
};
