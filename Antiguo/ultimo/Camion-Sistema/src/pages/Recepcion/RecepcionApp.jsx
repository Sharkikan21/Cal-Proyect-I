"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import { AnimatePresence, motion } from "framer-motion"
import { FaTruck, FaShieldAlt, FaCheck, FaEye, FaClipboardList } from "react-icons/fa"
import useIsMobile from '../../hooks/useIsMobile';
import "../../styles/Recepcion.css"; // Apunta a nuestro archivo de estilos unificado para este módulo
import ChecklistForm from "./components/ChecklistForm";
import Scene from "./components/Scene";
import cameraMapping from "./components/cameraConfig";
import { guardarInspeccion } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// La función ahora se llama como tu archivo para mantener consistencia
export default function RecepcionApp() {
    /* ---------- Estados principales ---------- */
    const [activeTab, setActiveTab] = useState("checklist")
    const [checklistData, setChecklistData] = useState(null)
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const [activeCameraName, setActiveCameraName] = useState("CAM_GENERAL")
    const [showRejectionModal, setShowRejectionModal] = useState(false)
    const [rejectionMessage, setRejectionMessage] = useState("")
    const [partesFalladasParaModal, setPartesFalladasParaModal] = useState([])
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [successModalMessage, setSuccessModalMessage] = useState("")
    const sceneRef = useRef(null)
    const [selectedPart, setSelectedPart] = useState(null)
    const [textValue, setTextValue] = useState("")
    const [selectedColor, setSelectedColor] = useState("")
    const [statusTable, setStatusTable] = useState({})
    const [nodes, setNodes] = useState(null)
    const [temporaryData, setTemporaryData] = useState([])
    const [inspectionData, setInspectionData] = useState({
        patente: { info: "", estado: "" },
        parabrisa: { info: "", estado: "" },
        ruedaDelanteraDerecha: { info: "", estado: "" },
        ruedaTraseraDerecha: { info: "", estado: "" },
        ruedasTripleDerecha: { info: "", estado: "" },
        ruedasTripleIzquierda: { info: "", estado: "" },
        ruedaTraseraIzquierda: { info: "", estado: "" },
        ruedaDelanteraIzquierda: { info: "", estado: "" },
    })

    /* ---------- El resto del código de la IA se mantiene intacto ---------- */
    /* --- Pega aquí toda la lógica interna (useEffect, handlers, etc.) --- */
    useEffect(() => {
        if (activeTab === "inspeccionA" && checklistData) {
            let attempts = 0
            const maxAttempts = 20
            const intervalBetweenAttempts = 100
            let animationIntervalId = null
            const tryCallingAnimation = () => {
                attempts++
                if (sceneRef.current && typeof sceneRef.current.animarIngresoCamion === "function") {
                    sceneRef.current.animarIngresoCamion()
                    if (animationIntervalId) clearInterval(animationIntervalId)
                } else if (attempts >= maxAttempts) {
                    if (animationIntervalId) clearInterval(animationIntervalId)
                }
            }
            const initialDelayTimeoutId = setTimeout(() => {
                tryCallingAnimation()
                if (
                    attempts < maxAttempts &&
                    !(sceneRef.current && typeof sceneRef.current.animarIngresoCamion === "function")
                ) {
                    animationIntervalId = setInterval(tryCallingAnimation, intervalBetweenAttempts)
                }
            }, 50)
            return () => {
                clearTimeout(initialDelayTimeoutId)
                if (animationIntervalId) {
                    clearInterval(animationIntervalId)
                }
            }
        }
    }, [activeTab, checklistData])

    const handleChecklistOk = (data) => {
        setChecklistData(data)
        if (data.patente) {
            setInspectionData((prev) => ({
                ...prev,
                patente: {
                    info: data.patente,
                    estado: "",
                },
            }))
        }
        setActiveTab("inspeccionA")
    }

    const visibleCameraKeys = Object.keys(cameraMapping).filter((key) => {
        const g = cameraMapping[key].grupo
        if (activeTab === "inspeccionA") return g === "A"
        return false
    })

    const totalParts = visibleCameraKeys.length
    const completedParts = visibleCameraKeys.reduce((acc, key) => {
        const nombre = cameraMapping[key].name
        return statusTable[nombre] ? acc + 1 : acc
    }, 0)
    const progress = Math.round((completedParts / (totalParts || 1)) * 100)

    const handleSelectCamera = (key) => {
        setActiveCameraName(key)
        const partInfo = cameraMapping[key]
        setSelectedPart(key === "CAM_GENERAL" ? null : (partInfo ?? null))
        setTextValue("")
        setSelectedColor("")
    }

    const closeModal = () => {
        setSelectedPart(null)
        setActiveCameraName("CAM_GENERAL")
    }

    const handleTabChange = (tab) => {
        closeModal()
        setActiveTab(tab)
    }

    const handleSubmitParte = (e) => {
        e.preventDefault()
        if (!selectedPart) return
        const isPatente = selectedPart.name.toLowerCase().includes("patente")
        if (!isPatente && !selectedColor) {
            alert("Debes seleccionar una condición.")
            return
        }
        const meshKey = cameraMapping[activeCameraName]?.nodeName
        const mesh = nodes?.[meshKey]
        if (mesh && mesh.material && selectedColor && !isPatente) {
            mesh.material.color.set(selectedColor === "verde" ? "green" : selectedColor === "naranja" ? "orange" : "red")
            mesh.material.needsUpdate = true
        }
        const dataKey = cameraMapping[activeCameraName]?.dataKey
        if (dataKey) {
            setInspectionData((prev) => ({
                ...prev,
                [dataKey]: {
                    info: textValue || "",
                    estado: selectedColor || "",
                },
            }))
        }
        setTemporaryData((prev) => [
            ...prev,
            {
                parte: selectedPart.name,
                informacion: textValue || "",
                estado: selectedColor || "",
            },
        ])
        setStatusTable((prev) => ({
            ...prev,
            [selectedPart.name]: selectedColor || "",
        }))
        const currentIndex = visibleCameraKeys.indexOf(activeCameraName)
        if (currentIndex < visibleCameraKeys.length - 1) {
            const nextCameraKey = visibleCameraKeys[currentIndex + 1]
            handleSelectCamera(nextCameraKey)
        } else {
            closeModal()
        }
    }

    const handleSendData = async () => {
        console.log("1. Datos del usuario al momento de enviar:", user);
        try {
            const patenteInfo = inspectionData.patente.info || checklistData?.patente
            if (!patenteInfo || patenteInfo.trim() === "") {
                alert("Error: No se ha registrado la patente del camión")
                return
            }
            const partesConFallas = []
            for (const key in inspectionData) {
                if (inspectionData[key].estado === "rojo") {
                    let nombreParteLegible = key.replace(/([A-Z])/g, " $1").trim()
                    nombreParteLegible = nombreParteLegible.charAt(0).toUpperCase() + nombreParteLegible.slice(1)
                    if (cameraMapping[key] && cameraMapping[key].name) {
                        nombreParteLegible = cameraMapping[key].name
                    }
                    partesConFallas.push(nombreParteLegible)
                }
            }
            if (partesConFallas.length > 0) {
                setRejectionMessage(
                    "No se acepta el camión debido a que el/los siguiente(s) componente(s) no está(n) en óptimas condiciones:",
                )
                setPartesFalladasParaModal(partesConFallas)
                setShowRejectionModal(true)
                return
            }
            const payload = {
                patente: patenteInfo,
                checklistData: checklistData,
                inspectionData: inspectionData,
            }
            console.log("2. Payload que se está enviando a la API:", payload);
            const data = await guardarInspeccion(payload)
            setSuccessModalMessage(
                `¡Inspección para la patente ${data.patente} registrada con éxito! Preparando salida del vehículo.`,
            )
            setShowSuccessModal(true)
            if (sceneRef.current && typeof sceneRef.current.playReturnAnimation === "function") {
                sceneRef.current.playReturnAnimation()
            }
            const delayParaVolverAChecklist = 5000
            setTimeout(() => {
                setShowSuccessModal(false)
                setActiveTab("checklist")
                setChecklistData(null)
                setInspectionData({
                    patente: { info: "", estado: "" },
                    parabrisa: { info: "", estado: "" },
                    ruedaDelanteraDerecha: { info: "", estado: "" },
                    ruedaTraseraDerecha: { info: "", estado: "" },
                    ruedasTripleDerecha: { info: "", estado: "" },
                    ruedasTripleIzquierda: { info: "", estado: "" },
                    ruedaTraseraIzquierda: { info: "", estado: "" },
                    ruedaDelanteraIzquierda: { info: "", estado: "" },
                })
                setStatusTable({})
                setTemporaryData([])
            }, delayParaVolverAChecklist)
        } catch (err) {
            alert(`Error al enviar los datos: ${err.message}`)
            console.error(err)
        }
    }
    const renderFormFields = () => {
        if (!selectedPart) return null;

        // Lógica para mostrar opciones del Parabrisas
        if (selectedPart.type === "parabrisas") {
            return (
                <>
                    <label>Condición del Parabrisas</label>
                    <div className="radio-group">
                        {[
                            { value: "Visión Clara", color: "verde", description: "Sin daños visibles" },
                            { value: "Trizado", color: "rojo", description: "Grietas que requieren reemplazo inmediato" },
                        ].map((opt) => (
                            <label key={opt.value} className={`radio-option-${opt.color}`}>
                                <input
                                    type="radio"
                                    name="parabrisas"
                                    value={opt.value}
                                    checked={textValue === opt.value}
                                    onChange={() => {
                                        setTextValue(opt.value);
                                        setSelectedColor(opt.color);
                                    }}
                                />
                                <div>
                                    <span className={`status-indicator ${opt.color}`}></span>
                                    <strong>{opt.value}</strong>
                                    <div style={{ fontSize: "12px", color: "#6c757d", marginLeft: "26px" }}>{opt.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </>
            );
        }

        // Lógica para mostrar opciones de las Ruedas
        if (selectedPart.type === "rueda") {
            return (
                <>
                    <label>Condición de la Rueda</label>
                    <div className="radio-group">
                        {[
                            { value: "Buen estado", color: "verde", description: "Dibujo completo, sin desgaste anormal" },
                            { value: "Recauchada", color: "rojo", description: "Requiere reemplazo inmediato" },
                        ].map((opt) => (
                            <label key={opt.value} className={`radio-option-${opt.color}`}>
                                <input
                                    type="radio"
                                    name="rueda"
                                    value={opt.value}
                                    checked={textValue === opt.value}
                                    onChange={() => {
                                        setTextValue(opt.value);
                                        setSelectedColor(opt.color);
                                    }}
                                />
                                <div>
                                    <span className={`status-indicator ${opt.color}`}></span>
                                    <strong>{opt.value}</strong>
                                    <div style={{ fontSize: "12px", color: "#6c757d", marginLeft: "26px" }}>{opt.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </>
            );
        }

        // Lógica para el campo de texto de la Patente
        if (selectedPart.type === "patente") {
            return (
                <>
                    <label>Ingrese la Patente</label>
                    <input
                        type="text"
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        placeholder="XY1234 O ABCD12"
                        maxLength="6"
                    />
                </>
            );
        }

        return null;
    };

    return (
        <>
            {/* Tabs */}
            <div className="tab-bar">
                <button className={activeTab === "checklist" ? "active" : ""} onClick={() => handleTabChange("checklist")}>
                    <span>
                        <FaClipboardList style={{ marginRight: "8px" }} />
                        Documentación
                    </span>
                </button>

                <button
                    className={activeTab === "inspeccionA" ? "active" : ""}
                    onClick={() => checklistData && handleTabChange("inspeccionA")}
                    disabled={!checklistData}
                >
                    <span>
                        <FaEye style={{ marginRight: "8px" }} />
                        Revisión
                    </span>
                </button>
            </div>

            {/* Contenido */}
            {activeTab === "checklist" && <ChecklistForm onValidated={handleChecklistOk} />}

            {activeTab === "inspeccionA" && (
                <AnimatePresence>
                    <motion.div
                        key={isMobile ? 'mobile' : 'desktop'}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                        <div className="unified-inspection-container">
                            {/* Header de inspección */}
                            <div className="inspection-header">
                                <div className="inspection-title">
                                    <div>
                                        <h2>Inspección Visual del Vehículo</h2>
                                        <p className="inspection-subtitle">
                                            Seleccione una cámara para inspeccionar diferentes componentes
                                        </p>
                                    </div>
                                </div>
                                <div className="inspection-progress">
                                    <div className="progress-circle" style={{ "--progress": `${progress * 3.6}deg` }}>
                                        <span className="progress-text-circle">{progress}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Contenido principal */}
                            <div className="inspection-content">
                                {/* Sección 3D */}
                                <section className="canvas-section">
                                    <div className="canvas-wrapper">
                                        <Canvas shadows>
                                            <OrbitControls />
                                            <ambientLight intensity={0.7} />
                                            <directionalLight position={[10, 10, 10]} intensity={2} castShadow />
                                            <Scene
                                                ref={sceneRef}
                                                activeCameraName={activeCameraName}
                                                selectedPart={selectedPart}
                                                selectedColor={selectedColor}
                                                statusTable={statusTable}
                                                setNodes={setNodes}
                                            />
                                        </Canvas>
                                    </div>
                                </section>

                                {/* Panel de resumen */}
                                <aside className="summary-panel">
                                    <div className="summary-header">
                                        <h3>Estado de Componentes</h3>
                                        <p className="summary-subtitle">Progreso de la inspección actual</p>
                                    </div>

                                    <ul className="summary-list">
                                        {visibleCameraKeys.map((key, index) => {
                                            const part = cameraMapping[key]
                                            const estado = statusTable[part.name]
                                            const infoPatente = inspectionData[part.dataKey]?.info

                                            let pillText = "Pendiente"
                                            let pillClass = "pendiente"
                                            let statusColor = "#94a3b8"

                                            if (part.type === "patente" && infoPatente) {
                                                pillText = "Registrada"
                                                pillClass = "verde"
                                                statusColor = "#22c55e"
                                            } else if (estado) {
                                                pillText = estado === "verde" ? "OK" : estado === "naranja" ? "Observación" : "Falla"
                                                pillClass = estado
                                                statusColor = estado === "verde" ? "#22c55e" : estado === "naranja" ? "#f59e0b" : "#ef4444"
                                            }

                                            return (
                                                <li
                                                    key={part.name}
                                                    className="summary-item"
                                                    style={{
                                                        "--status-color": statusColor,
                                                        animationDelay: `${index * 0.1}s`,
                                                    }}
                                                    onClick={() => handleSelectCamera(key)}
                                                >
                                                    <span className="summary-item-name">{part.name}</span>
                                                    <span className={`status-pill ${pillClass}`}>{pillText}</span>
                                                </li>
                                            )
                                        })}
                                    </ul>

                                    {temporaryData.length > 0 && (
                                        <button className="send-button" onClick={handleSendData}>
                                            <FaCheck style={{ marginRight: "8px" }} />
                                            Finalizar Inspección
                                        </button>
                                    )}
                                </aside>
                            </div>
                        </div>

                        {/* Modal de parte */}
                        {selectedPart && activeCameraName !== "CAM_GENERAL" && (
                            <AnimatePresence>
                                {/* Fondo oscuro animado */}
                                <motion.div
                                    key="overlay"
                                    className="modal-overlay"
                                    onClick={closeModal}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                />

                                {/* Formulario del modal animado */}
                                <motion.div
                                    key="modal"
                                    className="part-form"
                                    initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-45%" }}
                                    animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                                    exit={{ opacity: 0, scale: 0.95, y: "-45%" }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                >
                                    {/* El resto de tu modal (botón de cerrar, form, etc.) va aquí dentro */}
                                    <button className="close-modal" onClick={closeModal}>
                                        ×
                                    </button>
                                    <h3>{selectedPart.name}</h3>
                                    <form onSubmit={handleSubmitParte}>
                                        {renderFormFields()}
                                        <button type="submit" className="btn-primary">
                                            Guardar y Continuar
                                        </button>
                                    </form>
                                </motion.div>
                            </AnimatePresence>
                        )}

                        {/* Modal de éxito */}
                        {showSuccessModal && (
                            <div
                                className="part-form"
                                style={{
                                    backgroundColor: "#f0fdf4",
                                    borderColor: "#22c55e",
                                }}
                            >
                                <button className="close-modal" onClick={() => setShowSuccessModal(false)} style={{ color: "#16a34a" }}>
                                    ×
                                </button>
                                <h3 style={{ color: "#16a34a", borderBottomColor: "#bbf7d0" }}>
                                    <FaCheck style={{ marginRight: "10px", color: "#16a34a" }} />
                                    ¡Inspección Exitosa!
                                </h3>
                                <div style={{ padding: "15px 0", color: "#16a34a", lineHeight: "1.5" }}>
                                    <p>{successModalMessage}</p>
                                    <p style={{ marginTop: "10px", fontSize: "0.9em" }}>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Modal de rechazo */}
                        {showRejectionModal && (
                            <>
                                <div
                                    className="modal-overlay"
                                    onClick={() => {
                                        setShowRejectionModal(false)
                                        setPartesFalladasParaModal([])
                                    }}
                                ></div>
                                <div
                                    className="part-form"
                                    style={{
                                        borderColor: "#ef4444",
                                        backgroundColor: "#fef2f2",
                                    }}
                                >
                                    <button
                                        className="close-modal"
                                        onClick={() => {
                                            setShowRejectionModal(false)
                                            setPartesFalladasParaModal([])
                                        }}
                                        style={{ color: "#dc2626" }}
                                    >
                                        ×
                                    </button>
                                    <h3 style={{ color: "#dc2626", borderBottomColor: "#fecaca" }}>
                                        <FaShieldAlt style={{ marginRight: "10px", color: "#dc2626" }} />
                                        Inspección No Superada
                                    </h3>
                                    <div style={{ padding: "15px 0", color: "#dc2626", lineHeight: "1.5", textAlign: "left" }}>
                                        <p>{rejectionMessage}</p>
                                        <ul style={{ marginTop: "10px", paddingLeft: "20px", listStyleType: "disc" }}>
                                            {partesFalladasParaModal.map((parte, index) => (
                                                <li key={index} style={{ marginBottom: "5px" }}>
                                                    {parte}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{
                                            background: "linear-gradient(to bottom, #ef4444, #dc2626)",
                                            borderColor: "#b91c1c",
                                        }}
                                        onClick={() => {
                                            setShowRejectionModal(false)
                                            setPartesFalladasParaModal([])
                                        }}
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
        </>
    )
}
