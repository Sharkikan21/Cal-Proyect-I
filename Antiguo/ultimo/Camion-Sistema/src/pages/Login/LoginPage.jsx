// Ubicación: src/pages/Login/LoginPage.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import "../../styles/LoginPage.css";

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login, user } = useAuth();

    useEffect(() => {
        if (!user) return;
        const r = user?.rol;
        if (r === 'admin') navigate('/admin/procesos');
        else if (r === 'recepcionista-cal') navigate('/recepcion-cal');
        else if (r === 'recepcion') navigate('/recepcion');
        else navigate('/pesaje');
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password);
        if (!result.success) {
            setError(result.message || "Credenciales incorrectas o error en el servidor.");
        }
        setLoading(false);
    };

    return (
        <div className="login-page-container">
            <div className="login-header">
                <div className="logos-container">
                    <img src="/images/calx-logo.png" alt="Logo Calx-System" className="logo-calx" />
                    <img src="/images/grupo-clara.png" alt="Logo Grupo Clara" className="logo-clara" />
                </div>
            </div>
            <div className="login-content">
                <div className="left-content">
                    <motion.h1 className="login-title" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        Sistema de Inspección y Pesaje
                    </motion.h1>
                    <motion.p className="login-description" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                        Plataforma integral para la gestión de flotas de transporte en operaciones mineras.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <FaEnvelope className="form-icon" />
                                <input
                                    type="email"
                                    placeholder="Correo electrónico"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group password-group">
                                <FaLock className="form-icon" />
                                <input
                                    type={showPwd ? "text" : "password"}
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    aria-pressed={showPwd}
                                    onClick={() => setShowPwd((s) => !s)}
                                >
                                    {showPwd ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>

                            {error && <p className="error-message">{error}</p>}

                            <div className="login-button-container">
                                <motion.button
                                    type="submit"
                                    className="start-button"
                                    disabled={loading}
                                    whileHover={{ scale: loading ? 1 : 1.05 }}
                                    whileTap={{ scale: loading ? 1 : 0.95 }}
                                >
                                    {loading ? 'Ingresando...' : 'Ingresar'}
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>
                </div>
                <div className="right-content">
                    <motion.div className="truck-image-container" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
                        <img src="/images/Camion-foto.png" alt="Camión de transporte minero" className="main-truck-image" />
                    </motion.div>
                </div>
            </div>
        </div >
    );
}