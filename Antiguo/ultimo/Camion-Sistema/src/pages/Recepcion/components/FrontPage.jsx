"use client"
import { motion } from "framer-motion"
import { FaTruck, FaClipboardCheck, FaShieldAlt, FaChartLine } from "react-icons/fa"

export default function FrontPage({ onStart }) {
  return (
    <div className="frontpage-container">
      {/* Header con logos */}
      <div className="frontpage-header">
        <div className="logos-container">
          <img src="/images/calx-logo.png" alt="Logo Calx-System" className="logo-calx" />
          <img src="/images/grupo-clara.png" alt="Logo Grupo Clara" className="logo-clara" />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="frontpage-content">
        <div className="left-content">
          <motion.h1
            className="frontpage-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Sistema de Inspección de Camiones
          </motion.h1>

          <motion.h2
            className="frontpage-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Grupo Clara
          </motion.h2>

          <motion.p
            className="frontpage-description"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Plataforma avanzada para la gestión e inspección de flotas de transporte en operaciones mineras. Optimice
            sus procesos de verificación y mantenimiento con nuestra solución integral.
          </motion.p>

          <motion.div
            className="features-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="feature-item">
              <FaClipboardCheck className="feature-icon" />
              <span>Inspección Digital</span>
            </div>
            <div className="feature-item">
              <FaShieldAlt className="feature-icon" />
              <span>Seguridad Avanzada</span>
            </div>
            <div className="feature-item">
              <FaTruck className="feature-icon" />
              <span>Gestión de Flota</span>
            </div>
            <div className="feature-item">
              <FaChartLine className="feature-icon" />
              <span>Análisis en Tiempo Real</span>
            </div>
          </motion.div>

          <motion.button
            className="start-button"
            onClick={onStart}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Iniciar Inspección
          </motion.button>
        </div>

        <div className="right-content">
          <motion.div
            className="truck-image-container"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <img src="/images/Camion-foto.png" alt="Camión de transporte minero" className="main-truck-image" />
          </motion.div>
        </div>
      </div>

      {/* Decoración de fondo */}
      <div className="background-decoration">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>
    </div>
  )
}
