// Ubicación: src/pages/Recepcion/RecepcionPage.jsx

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import RecepcionApp from './RecepcionApp';

export default function RecepcionPage() {
    const { user } = useAuth();

    // Si el usuario es recepcionista-cal, redirigir al nuevo módulo
    if (user?.rol === 'recepcionista-cal') {
        return <Navigate to="/recepcion-cal" replace />;
    }

    // Para otros roles (recepcion, admin), mostrar el componente original
    return <RecepcionApp />;
}