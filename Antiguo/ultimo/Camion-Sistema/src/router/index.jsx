// src/router/index.jsx
import {
    createBrowserRouter,
    createHashRouter,
    Navigate,
} from 'react-router-dom';
import PrivateRoute from './PrivateRoute';

// Layouts / Pages
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/Login/LoginPage';
import RecepcionPage from '../pages/Recepcion/RecepcionPage';
import PesajePage from '../pages/Pesaje/PesajePage';
import RecepcionCalPage from '../pages/recepcion-cal/RecepcionCalPage';
import LogsPage from '../pages/Admin/LogsPage';
import DetallesProceso from '/src/pages/Proceso/DetallesProceso.jsx';
import ManguerasAdmin from '../pages/Admin/ManguerasAdmin';
import SiloMonitor from '../pages/Admin/SiloMonitor';
import ProcesosPage from '../pages/Procesos/ProcesosPage';

const routes = [
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/',
        element: (
            <PrivateRoute>
                <MainLayout />
            </PrivateRoute>
        ),
        children: [
            {
                path: '/proceso/:id/detalles',
                element: (
                    <PrivateRoute roles={['admin']}>
                        <DetallesProceso />
                    </PrivateRoute>
                ),
            },
            {
                path: 'recepcion',
                element: (
                    <PrivateRoute roles={['admin', 'recepcion', 'recepcionista-cal']}>
                        <RecepcionPage />
                    </PrivateRoute>
                ),
            },
            {
                path: 'recepcion-cal',
                element: (
                    <PrivateRoute roles={['admin', 'recepcionista-cal']}>
                        <RecepcionCalPage />
                    </PrivateRoute>
                ),
            },
            {
                path: 'pesaje',
                element: (
                    <PrivateRoute roles={['admin', 'pesaje']}>
                        <PesajePage />
                    </PrivateRoute>
                ),
            },
            {
                path: 'admin/silo-monitor',
                element: (
                    <PrivateRoute roles={['admin']}>
                        <SiloMonitor />
                    </PrivateRoute>
                ),
            },
            {
                path: 'admin/mangueras',
                element: (
                    <PrivateRoute roles={['admin']}>
                        <ManguerasAdmin />
                    </PrivateRoute>
                ),
            },
            {
                path: 'admin/logs',
                element: (
                    <PrivateRoute roles={['admin']}>
                        <LogsPage />
                    </PrivateRoute>
                ),
            },
            {
                path: 'procesos',
                element: (
                    <PrivateRoute roles={['admin']}>
                        <ProcesosPage />
                    </PrivateRoute>
                ),
            },
            // landing por defecto
            { index: true, element: <Navigate to="/recepcion" replace /> },
        ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
];

// 👇 Exportamos una fábrica para crear el router correcto
export function createAppRouter(isElectron) {
    return isElectron ? createHashRouter(routes) : createBrowserRouter(routes);
}
