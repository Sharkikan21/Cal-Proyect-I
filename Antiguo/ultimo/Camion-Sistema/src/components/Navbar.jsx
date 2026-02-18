// Ubicación: src/components/Navbar.jsx

import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// Importamos los iconos que usaremos, incluyendo el de menú (FaBars)
import { FaTruck, FaWeight, FaUserCircle, FaSignOutAlt, FaBars, FaWarehouse, FaProjectDiagram, FaHistory, FaIndustry, FaBoxOpen } from "react-icons/fa";
import { FaRoadBarrier } from "react-icons/fa6";
// MUY IMPORTANTE: Importamos el nuevo archivo CSS que crearemos en el siguiente paso
import "../styles/Navbar.css";

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // ---- NUEVO ESTADO ----
    // Este estado controlará si el menú desplegable en móvil está visible o no.
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const linkActiveClass = ({ isActive }) => isActive ? "navbar-link active" : "navbar-link";

    // Función para obtener la ruta principal según el rol
    const getHomeRoute = () => {
        if (user?.rol === 'admin') return '/admin/mangueras';
        if (user?.rol === 'recepcion') return '/recepcion';
        if (user?.rol === 'recepcionista-cal') return '/recepcion-cal';
        if (user?.rol === 'pesaje') return '/pesaje';
        return '/recepcion'; // fallback
    };

    return (
        <nav className="navbar">
            <div className="navbar-content">
                <Link to={getHomeRoute()} className="navbar-brand">
                    <FaTruck />
                    <span>Sistema cal</span>
                </Link>

                <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
                    <FaBars />
                </button>

                {/* A la clase 'navbar-menu' le añadimos la clase 'open' cuando se activa */}
                <div className={`navbar-menu ${menuOpen ? 'open' : ''}`}>

                    {/* Contenedor solo para los enlaces de navegación */}
                    <div className="navbar-links">
                        {/* ADMIN */}
                        {user?.rol === 'admin' && (
                            <>
                                <NavLink to="/admin/silo-monitor" className={linkActiveClass} title="Silo" onClick={() => setMenuOpen(false)}>
                                    <FaWarehouse /> <span className="link-label">Silo</span>
                                </NavLink>
                                <NavLink to="/admin/mangueras" className={linkActiveClass} title="Mangueras" onClick={() => setMenuOpen(false)}>
                                    <FaProjectDiagram /> <span className="link-label">Mangueras</span>
                                </NavLink>
                                <NavLink to="/admin/logs" className={linkActiveClass} title="Ver Logs" onClick={() => setMenuOpen(false)}>
                                    <FaHistory /> <span className="link-label">Logs</span>
                                </NavLink>
                                <NavLink to="/recepcion" className={linkActiveClass} title="Recepción" onClick={() => setMenuOpen(false)}>
                                    <FaRoadBarrier /> <span className="link-label">Recepción</span>
                                </NavLink>
                                <NavLink to="/pesaje" className={linkActiveClass} title="Pesaje" onClick={() => setMenuOpen(false)}>
                                    <FaWeight /> <span className="link-label">Pesaje</span>
                                </NavLink>
                                <NavLink to="/recepcion-cal" className={linkActiveClass} title="Recepción Cal" onClick={() => setMenuOpen(false)}>
                                    <FaIndustry /> <span className="link-label">Recepción Cal</span>
                                </NavLink>
                                <NavLink to="/procesos" className={linkActiveClass} title="Procesos" onClick={() => setMenuOpen(false)}>
                                    <FaHistory /> <span className="link-label">Procesos</span>
                                </NavLink>
                            </>
                        )}

                        {/* RECEPCIÓN */}
                        {user?.rol === 'recepcion' && (
                            <NavLink to="/recepcion" className={linkActiveClass} onClick={() => setMenuOpen(false)}>
                                <FaBoxOpen /> <span className="link-label">Recepción</span>
                            </NavLink>
                        )}

                        {/* RECEPCIÓN CAL */}
                        {user?.rol === 'recepcionista-cal' && (
                            <NavLink to="/recepcion-cal" className={linkActiveClass} onClick={() => setMenuOpen(false)}>
                                <FaBoxOpen /> <span className="link-label">Recepción Cal</span>
                            </NavLink>
                        )}

                        {/* PESAJE */}
                        {user?.rol === 'pesaje' && (
                            <NavLink to="/pesaje" className={linkActiveClass} onClick={() => setMenuOpen(false)}>
                                <FaWeight /> <span className="link-label">Pesaje</span>
                            </NavLink>
                        )}

                    </div>

                    {/* Contenedor solo para la información del usuario y logout */}
                    <div className="user-info-container">
                        <div className="user-details">
                            <FaUserCircle size="1.2em" />
                            <span>{user.email}</span>
                            <span className="user-role">({user?.rol})</span>
                        </div>
                        <button onClick={handleLogout} className="logout-btn" title="Cerrar sesión">
                            <FaSignOutAlt size="1.2em" />
                            <span>Desconectar</span> {/* Añadimos texto para claridad */}
                        </button>
                    </div>

                </div>
            </div>
        </nav>
    );

}