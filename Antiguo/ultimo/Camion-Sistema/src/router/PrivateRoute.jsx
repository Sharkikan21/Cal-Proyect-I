// src/router/PrivateRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SessionLoader from './SessionLoader';

export default function PrivateRoute({ children, roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <SessionLoader message="Verificando sesión…" />;
    }
    if (user && location.pathname === '/login') {
        const homeRoute =
            user.rol === 'admin' ? '/admin/procesos' :
                user.rol === 'recepcion' ? '/recepcion' :
                    user.rol === 'recepcionista-cal' ? '/recepcion-cal' :
                        '/pesaje';
        return <Navigate to={homeRoute} />;
    }
    if (!user && location.pathname !== '/login') {
        return <Navigate to="/login" />;
    }
    if (user && roles && !roles.includes(user.rol)) {
        const homeRoute =
            user.rol === 'admin' ? '/admin/procesos' :
                user.rol === 'recepcion' ? '/recepcion' :
                    user.rol === 'recepcionista-cal' ? '/recepcion-cal' :
                        '/pesaje';
        return <Navigate to={homeRoute} />;
    }

    return children;
}
