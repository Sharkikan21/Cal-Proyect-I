// Ubicación: src/context/AuthContext.jsx (Versión Final y Robusta)

import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Esta función se encarga de verificar la sesión y obtener el perfil del usuario
        const setupUserSession = async (session) => {
            if (session?.user) {
                const { data: profile, error } = await supabase
                    .from('usuarios')
                    .select('rol, fecha_expiracion')
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error("Error al buscar perfil:", error.message);
                    await supabase.auth.signOut(); // Si no hay perfil, cerramos sesión
                    setUser(null);
                    return;
                }

                if (profile) {
                    if (profile.fecha_expiracion && new Date(profile.fecha_expiracion) < new Date()) {
                        console.error("La cuenta del usuario ha expirado.");
                        await supabase.auth.signOut();
                        setUser(null);
                    } else {
                        setUser({ ...session.user, ...profile });
                    }
                }
            } else {
                setUser(null);
            }
        };

        // 1. Verificamos la sesión al cargar la página
        const initializeSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            await setupUserSession(session);
            setLoading(false);
        }
        initializeSession();

        // 2. Escuchamos cambios en la autenticación (login/logout)
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setupUserSession(session);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const login = async (email, password) => {
        // La función login ahora solo se encarga de validar las credenciales
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        // El useEffect de arriba se encargará del resto
        if (error) {
            return { success: false, message: "Credenciales incorrectas." };
        }
        return { success: true, user: data.user };
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const value = { user, loading, login, logout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de un AuthProvider');
    }
    return context;
}