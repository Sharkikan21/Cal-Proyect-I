// Ubicación: src/pages/recepcion-cal/components/InspeccionB.jsx

"use client"

import { useState, useEffect, useRef, Suspense, useCallback } from "react"
import { useProcesoCamion } from "../../../context/ProcesoCamionContext"
import { FaArrowRight, FaTimes, FaTruck, FaClipboardList, FaExclamationTriangle } from "react-icons/fa"
import { guardarInspeccionB, logActivity as logApiActivity } from "../../../services/api";
import { manguerasApi, useMangueras, obtenerEstadoManguera } from "../../../services/manguerasAPI";
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import { AnimatePresence, motion } from "framer-motion"
import { Vector3, LoopOnce } from "three";
import ChecklistBModal from '../ChecklistBModal.jsx';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from "react-router-dom";

const asset = (relPath) => new URL(relPath, window.location.href).toString();
const RUTA_MODELO_VISUAL_GLB = asset('./modelo/Silo2.glb');
const RUTA_MODELO_ANIMACION_GLB = asset('./modelo/a05(carga).glb');
useGLTF.preload(RUTA_MODELO_VISUAL_GLB);
useGLTF.preload(RUTA_MODELO_ANIMACION_GLB);


// Componente EscenaCamion para el modelo 3D
function EscenaCamion({
    modeloVisualPath,
    modeloAnimacionPath,
    activeCameraName,
    nombreAnimacionActiva,
    escalaGeneral = 1,
    partsToHide = [],
    onNodesLoaded = () => { },
    onAnimationsLoaded = () => { },
    statusTable = {}
}) {
    const { scene: escenaVisual, nodes: nodosVisuales, cameras: camarasVisual } = useGLTF(modeloVisualPath);
    const { animations: animacionesDelArchivo } = useGLTF(modeloAnimacionPath);
    const { actions, mixer } = useAnimations(animacionesDelArchivo, escenaVisual);
    const { camera: mainCam, controls } = useThree();
    const materialsCloned = useRef(false);

    useEffect(() => {
        if (nodosVisuales) onNodesLoaded(nodosVisuales);
        if (animacionesDelArchivo) onAnimationsLoaded(animacionesDelArchivo.map(a => a.name));
    }, [nodosVisuales, animacionesDelArchivo]);

    useEffect(() => {
        if (nodosVisuales) {
            for (const nodeName in nodosVisuales) {
                const node = nodosVisuales[nodeName];
                if (node && typeof node.visible === "boolean") {
                    node.visible = !partsToHide.includes(nodeName);
                }
            }
        }
    }, [nodosVisuales, partsToHide]);

    useEffect(() => {
        if (escenaVisual) {
            escenaVisual.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true
                    child.receiveShadow = true
                    if (child.material) {
                        child.material.side = 2
                    }
                }
            })
        }
    }, [escenaVisual])

    useEffect(() => {
        if (activeCameraName && camarasVisual?.length > 0) {
            const camara = camarasVisual.find((c) => c.name === activeCameraName);
            if (camara) {
                mainCam.position.copy(camara.position);
                mainCam.quaternion.copy(camara.quaternion);
                if (camara.isPerspectiveCamera) {
                    mainCam.fov = camara.fov;
                    mainCam.near = camara.near;
                    mainCam.far = camara.far;
                }
                mainCam.updateProjectionMatrix();
                if (controls) {
                    const lookAt = new Vector3(0, 0, -1).applyQuaternion(mainCam.quaternion).add(mainCam.position);
                    controls.target.copy(lookAt);
                    controls.update();
                }
            }
        }
    }, [activeCameraName, camarasVisual]);

    useEffect(() => {
        if (nombreAnimacionActiva && actions?.[nombreAnimacionActiva]) {
            const action = actions[nombreAnimacionActiva];
            action.reset();
            action.setLoop(LoopOnce);
            action.clampWhenFinished = true;
            action.play();
            mixer.addEventListener("finished", () => { });
            return () => {
                mixer.removeEventListener("finished", () => { });
                action.stop();
            };
        }
    }, [actions, nombreAnimacionActiva]);

    // Aplicar colores según el statusTable
    useEffect(() => {
        if (nodosVisuales && statusTable) {
            Object.keys(statusTable).forEach((partName) => {
                const node = nodosVisuales[partName];
                if (node && node.material) {
                    const status = statusTable[partName];
                    // Aceptamos distintos vocabularios desde la UI: bien/mal/atencion o aprobado/rechazado
                    if (status === "aprobado" || status === "bien") {
                        node.material.color.setHex(0x00ff00); // Verde
                    } else if (status === "rechazado" || status === "mal") {
                        node.material.color.setHex(0xff0000); // Rojo
                    } else if (status === "atencion" || status === "naranja") {
                        node.material.color.set("orange"); // Naranja
                    } else {
                        node.material.color.setHex(0xffffff); // Blanco (default)
                    }
                }
            });
        }
    }, [nodosVisuales, statusTable]);

    return (
        <primitive object={escenaVisual} />
    );
}

export const InspeccionBUI = ({
    statusTable,
    onInspectionComplete
}) => {
    const { camionActual, checklistB, setChecklistB, comentarios, setComentarios, avanzarEtapa, ensureLockOrExplain } = useProcesoCamion()
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [showInspectionDialog, setShowInspectionDialog] = useState(false)
    const [currentInspection, setCurrentInspection] = useState(null)
    const [inspectionResult, setInspectionResult] = useState("bien")
    const [selectedPart, setSelectedPart] = useState(null)
    const [textValue, setTextValue] = useState("")
    const [selectedColor, setSelectedColor] = useState("")
    const [temporaryData, setTemporaryData] = useState([])
    const [showChecklistDialog, setShowChecklistDialog] = useState(false);
    const [manguerasAsignadas, setManguerasAsignadas] = useState([]);
    const [manguerasDisponibles, setManguerasDisponibles] = useState([]);
    const [manguerasLoading, setManguerasLoading] = useState(true);
    const [manguerasError, setManguerasError] = useState(null);
    const [showMangueraSelector, setShowMangueraSelector] = useState(false);
    const [tipoMangueraParaAsignar, setTipoMangueraParaAsignar] = useState(null);
    const [abrazaderasChecks, setAbrazaderasChecks] = useState({
        colocada: false,
        asegurada: false,
        estado: false,
    });
    const [seguridadChecks, setSeguridadChecks] = useState({
        cadenas: false,
        boton: false,
        confinamiento: false,
    });

    // Define partsMapping at the top
    const partsMapping = [
        { key: "tapaSuperior", name: "Tapa Superior" },
        { key: "mangueraCal", name: "Manguera de Cal", type: "manguera" },
        { key: "mangueraAire", name: "Manguera de Aire", type: "manguera" },
        { key: "abrazaderas", name: "Abrazaderas" },
        { key: "compresor", name: "Compresor" },
        { key: "seguridad", name: "Seguridad" },
    ];

    // Calculate progress
    const totalParts = partsMapping.length;
    const completedParts = partsMapping.filter(part => {
        if (part.type === 'manguera') {
            const tipo = part.key.replace('manguera', '').toLowerCase();
            return manguerasAsignadas.find(m => m.tipo_manguera.toLowerCase().includes(tipo));
        } else {
            return statusTable[part.key];
        }
    }).length;
    const progress = totalParts > 0 ? Math.round((completedParts / totalParts) * 100) : 0;

    const handleAbrazaderasChange = (e) => {
        const { name, checked } = e.target;
        setAbrazaderasChecks(prev => ({
            ...prev,
            [name]: checked,
        }));
    };
    const handleSeguridadChange = (e) => {
        const { name, checked } = e.target;
        setSeguridadChecks(prev => ({
            ...prev,
            [name]: checked,
        }));
    };

    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === "Escape") {
                if (showInspectionDialog) closeInspectionDialog();
            }
        };
        window.addEventListener("keydown", handleEscKey);
        return () => {
            window.removeEventListener("keydown", handleEscKey);
        };
    }, [showInspectionDialog]);

    const handleOpenInspection = (partKey) => {
        setCurrentInspection(partKey);
        const estadoGuardado = checklistB[partKey];
        if (estadoGuardado === true) setInspectionResult("bien");
        else if (estadoGuardado === false) setInspectionResult("mal");
        else setInspectionResult("");
        setShowInspectionDialog(true);
    };

    const handleSubmit = async (e) => {
        if (!(await ensureLockOrExplain())) { navigate("/recepcion-cal"); return; }
        e.preventDefault();

        const datosParaApi = {
            proceso_id: camionActual?.id,
            partes: temporaryData,
            usuario_id: user?.id
        };

        console.log("Enviando payload de Inspección B:", datosParaApi);

        try {
            setLoading(true);
            setError(null);

            await guardarInspeccionB(datosParaApi);
            await logApiActivity('REGISTRO_INSPECCION_B', {
                procesoId: camionActual?.id,
                patente: camionActual?.patente,
                cantidad_partes_inspeccionadas: temporaryData.length
            });

            avanzarEtapa();

        } catch (err) {
            console.error("Error al guardar la inspección B:", err);
            setError("Error al guardar la inspección. Por favor, intente nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    const toggleChecklistDialog = () => {
        setShowChecklistDialog(!showChecklistDialog);
    };

    const closeInspectionDialog = () => {
        setShowInspectionDialog(false);
        setCurrentInspection(null);
        setInspectionResult("");
        setTextValue("");
    };

    const handleInspectionResultChange = (e) => {
        setInspectionResult(e.target.value);
    };

    const confirmInspectionResult = () => {
        if (!currentInspection) return;

        // Determinar el estado final según el tipo de inspección
        let resultado = inspectionResult;

        if (currentInspection === "abrazaderas") {
            const completos = abrazaderasChecks.colocada && abrazaderasChecks.asegurada && abrazaderasChecks.estado;
            if (!completos) return; // botón deshabilita, pero por seguridad
            resultado = "bien";
        } else if (currentInspection === "seguridad") {
            const completos = seguridadChecks.cadenas && seguridadChecks.boton && seguridadChecks.confinamiento;
            if (!completos) return;
            resultado = "bien";
        }

        if (!resultado) return;

        // Actualizamos la tabla de estado visual en el padre (para que deje de mostrar "Pendiente")
        if (onInspectionComplete) {
            onInspectionComplete(currentInspection, resultado);
        }

        // Persistimos en el buffer de envío
        setTemporaryData(prev => [
            ...prev.filter(item => item.nombre_parte !== currentInspection),
            {
                nombre_parte: `B:${currentInspection}`,
                informacion: textValue || "",
                estado: resultado,
            },
        ]);

        closeInspectionDialog();
    };

    // Función para obtener la manguera específica
    const obtenerMangueraAsignada = (tipo) => {
        return manguerasAsignadas.find(m => m.tipo_manguera.toLowerCase().includes(tipo.toLowerCase()));
    };

    // Función para verificar si una manguera puede ser usada
    const puedeUsarManguera = (tipo) => {
        const manguera = obtenerMangueraAsignada(tipo);
        if (!manguera) return true; // Si no hay info, permitir uso

        const estado = obtenerEstadoManguera(manguera.horas_uso_actual, manguera.vida_util_horas);
        return estado.permitirUso;
    };

    const cargarDatos = useCallback(async () => {
        // Creamos un timer que activará el spinner solo si la carga es lenta
        const loadingTimer = setTimeout(() => {
            setManguerasLoading(true);
        }, 300); // 300 milisegundos de espera

        try {
            setManguerasError(null);
            const [asignadasData, disponiblesData] = await Promise.all([
                manguerasApi.obtenerManguerasPorCamion(camionActual?.id),
                manguerasApi.obtenerManguerasDisponibles()
            ]);
            setManguerasAsignadas(asignadasData);
            setManguerasDisponibles(disponiblesData);

        } catch (err) {
            setManguerasError("No se pudieron cargar los datos de mangueras.");
            console.error(err);

        } finally {
            // Al terminar, siempre limpiamos el timer y ocultamos el spinner
            clearTimeout(loadingTimer);
            setManguerasLoading(false);
        }
    }, [camionActual?.id]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const handleAbrirSelector = (tipo) => { // tipo será 'cal' o 'aire'
        setTipoMangueraParaAsignar(tipo);
        setShowMangueraSelector(true);
    };

    const handleAsignarManguera = async (mangueraAAsignar) => {
        const estado = obtenerEstadoManguera(mangueraAAsignar.horas_uso_actual, mangueraAAsignar.vida_util_horas);
        if (estado.nivel === 'alerta' || estado.nivel === 'critico') {
            const mensajeAlerta = estado.nivel === 'alerta'
                ? `ADVERTENCIA: Esta manguera ha superado el 80% de su vida útil (${Math.round(mangueraAAsignar.horas_uso_actual)}/${mangueraAAsignar.vida_util_horas}h). ¿Está seguro de que desea asignarla?`
                : `PELIGRO: Esta manguera ha superado el 90% de su vida útil y se considera crítica (${Math.round(mangueraAAsignar.horas_uso_actual)}/${mangueraAAsignar.vida_util_horas}h). ¿ESTÁ SEGURO DE QUE DESEA ASIGNARLA?`;
            const confirmadoPorUsuario = window.confirm(mensajeAlerta);
            if (!confirmadoPorUsuario) {
                return;
            }
        }
        try {
            await manguerasApi.actualizarManguera(mangueraAAsignar.id, {
                proceso_id: camionActual.id
            });
            setManguerasDisponibles(prev => prev.filter(m => m.id !== mangueraAAsignar.id));
            setManguerasAsignadas(prev => {
                const nuevoEstado = [...prev, { ...mangueraAAsignar, proceso_id: camionActual.id }];
                return nuevoEstado;
            });

            setShowMangueraSelector(false);

        } catch (err) {
            console.error("%cPaso 3.1: ¡ERROR! La llamada a la API 'actualizarManguera' falló.", "color: red; font-weight: bold;");
            console.error("Detalle del error:", err);
            setError("¡Error al asignar la manguera! Por favor, inténtelo de nuevo.");
        }
    };

    const renderInspectionOptions = () => {
        if (!currentInspection) return null;

        switch (currentInspection) {
            case "tapaSuperior":
                return (
                    <div className="radio-group">
                        <label className="radio-option-verde">
                            <input
                                type="radio"
                                value="bien"
                                checked={inspectionResult === "bien"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Tapa correctamente instalada y segura</strong>
                                <div className="description">El componente se encuentra en estado óptimo para la operación.</div>
                            </div>
                        </label>
                        <label className="radio-option-rojo">
                            <input
                                type="radio"
                                value="mal"
                                checked={inspectionResult === "mal"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                            />
                            <span className="status-indicator rojo"></span>
                            <div className="radio-content">
                                <strong>Cerrar bien y asegurar</strong>
                                <div className="description">Requiere atención antes de presurizar el silo del camión.</div>
                            </div>
                        </label>
                    </div>
                );

            case "mangueraCal":
            case "mangueraAire":
                const tipoManguera = currentInspection === "mangueraCal" ? "cal" : "aire";
                const manguera = obtenerMangueraAsignada(tipoManguera);
                const puedeUsar = puedeUsarManguera(tipoManguera);

                if (!manguera) {
                    return (
                        <div className="alert alert-warning">
                            <FaExclamationTriangle />
                            <span>No se encontró información de esta manguera. Contacte al administrador.</span>
                        </div>
                    );
                }

                const estadoManguera = obtenerEstadoManguera(manguera.horas_uso_actual, manguera.vida_util_horas);

                return (
                    <div className="radio-group">
                        <label className={`radio-option-${estadoManguera.color === 'green' ? 'verde' : estadoManguera.color === 'orange' ? 'naranja' : 'rojo'}`}>
                            <input
                                type="radio"
                                value="bien"
                                checked={inspectionResult === "bien"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                                disabled={!puedeUsar}
                            />
                            <span className={`status-indicator ${estadoManguera.color === 'green' ? 'verde' : estadoManguera.color === 'orange' ? 'naranja' : 'rojo'}`}></span>
                            <div className="radio-content">
                                <strong>{estadoManguera.mensaje}</strong>
                                <div className="description">
                                    {estadoManguera.nivel === 'normal' ?
                                        'Estado operativo normal' :
                                        estadoManguera.nivel === 'alerta' ?
                                            'Programar cambio próximamente' :
                                            'Cambio inmediato requerido'
                                    }
                                </div>
                            </div>
                        </label>
                        {estadoManguera.nivel === 'alerta' && (
                            <label className="radio-option-naranja">
                                <input
                                    type="radio"
                                    value="atencion"
                                    checked={inspectionResult === "atencion"}
                                    onChange={(e) => setInspectionResult(e.target.value)}
                                />
                                <span className="status-indicator naranja"></span>
                                <div className="radio-content">
                                    <strong>Atención por cumplir vida útil requiere cambio</strong>
                                    <div className="description">Programar reemplazo antes del próximo ciclo.</div>
                                </div>
                            </label>
                        )}
                    </div>
                );

            case "abrazaderas":
                return (
                    <div className="radio-group">
                        <label className="radio-option-verde">
                            <input
                                type="checkbox"
                                name="colocada"
                                checked={abrazaderasChecks.colocada}
                                onChange={handleAbrazaderasChange}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Bien colocada</strong>
                                <div className="description">Posicionada correctamente.</div>
                            </div>
                        </label>

                        <label className="radio-option-verde">
                            <input
                                type="checkbox"
                                name="asegurada"
                                checked={abrazaderasChecks.asegurada}
                                onChange={handleAbrazaderasChange}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Bien asegurada</strong>
                                <div className="description">Firmemente ajustada.</div>
                            </div>
                        </label>

                        <label className="radio-option-verde">
                            <input
                                type="checkbox"
                                name="estado"
                                checked={abrazaderasChecks.estado}
                                onChange={handleAbrazaderasChange}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Buen estado</strong>
                                <div className="description">Sin daños visibles.</div>
                            </div>
                        </label>
                    </div>
                );

            case "compresor":
                return (
                    <div className="radio-group">
                        <label className="radio-option-verde">
                            <input
                                type="radio"
                                value="bien"
                                checked={inspectionResult === "bien"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Equipo en operación y con presión adecuada</strong>
                                <div className="description">Funcionando dentro de parámetros normales.</div>
                            </div>
                        </label>
                        <label className="radio-option-rojo">
                            <input
                                type="radio"
                                value="mal"
                                checked={inspectionResult === "mal"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                            />
                            <span className="status-indicator rojo"></span>
                            <div className="radio-content">
                                <strong>Requiere atención</strong>
                                <div className="description">Presión o funcionamiento deficiente.</div>
                            </div>
                        </label>
                    </div>
                );

            case "seguridad":
                return (
                    <div className="radio-group">
                        <label className="radio-option-verde">
                            <input
                                type="checkbox"
                                name="cadenas"
                                checked={seguridadChecks.cadenas}
                                onChange={handleSeguridadChange}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Cadenas de seguridad bien instaladas</strong>
                                <div className="description">En manguerote y camión.</div>
                            </div>
                        </label>
                        <label className="radio-option-verde">
                            <input
                                type="checkbox"
                                name="boton"
                                checked={seguridadChecks.boton}
                                onChange={handleSeguridadChange}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Botón de emergencia en buen estado y operativo</strong>
                                <div className="description">Probado y funcionando.</div>
                            </div>
                        </label>
                        <label className="radio-option-verde">
                            <input
                                type="checkbox"
                                name="confinamiento"
                                checked={seguridadChecks.confinamiento}
                                onChange={handleSeguridadChange}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Confinamiento del área revisada y está OK</strong>
                                <div className="description">Área segura y delimitada.</div>
                            </div>
                        </label>
                    </div>
                );

            default:
                return (
                    <div className="radio-group">
                        <label className="radio-option-verde">
                            <input
                                type="radio"
                                value="bien"
                                checked={inspectionResult === "bien"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                            />
                            <span className="status-indicator verde"></span>
                            <div className="radio-content">
                                <strong>Buen estado</strong>
                                <div className="description">Componente operativo y sin daños.</div>
                            </div>
                        </label>
                        <label className="radio-option-rojo">
                            <input
                                type="radio"
                                value="mal"
                                checked={inspectionResult === "mal"}
                                onChange={(e) => setInspectionResult(e.target.value)}
                            />
                            <span className="status-indicator rojo"></span>
                            <div className="radio-content">
                                <strong>Mal estado</strong>
                                <div className="description">Requiere reparación o atención.</div>
                            </div>
                        </label>
                    </div>
                );
        }
    };

    const handleChecklistChange = (e) => {
        const { name, checked } = e.target;
        setChecklistB((prev) => ({
            ...prev,
            [name]: checked,
        }));
    };

    const handleComentariosChange = (e) => {
        setComentarios(e.target.value);
    };

    return (
        <>
            {error && (
                <div className="error-alerta">
                    <p><span role="img" aria-label="Warning">⚠️</span> {error}</p>
                </div>
            )}
            {manguerasError && <div className="error-message">Error al cargar información de mangueras</div>}
            <aside className="summary-panel">
                <h2>Resumen de Inspección</h2>
                <p className="subtitle" style={{ color: '#6c757d', marginTop: '-0.5rem', marginBottom: '1rem' }}>Estado actual de la inspección</p>
                {manguerasLoading && (
                    <div className="loading-spinner-container">
                        <div className="loading-spinner"></div>
                        <span>Cargando mangueras...</span>
                    </div>
                )}
                {manguerasError && <div className="error-message">No se pudieron cargar los datos de mangueras.</div>}
                {manguerasLoading && (
                    <div className="loading-indicator">
                        <span>Cargando información de mangueras...</span>
                    </div>
                )}
                <div className="progress-info">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="progress-text">{completedParts} de {totalParts} completados</span>
                </div>

                <ul className="summary-list">
                    {partsMapping.map((part) => {
                        const esManguera = part.type === 'manguera';
                        if (esManguera) {
                            const tipo = part.key.replace('manguera', '').toLowerCase();
                            const mangueraAsignada = manguerasAsignadas.find(m => m.tipo_manguera.toLowerCase().includes(tipo));
                            return (
                                <li key={part.key} className="summary-item" onClick={() => handleAbrirSelector(tipo)}>
                                    <span>{part.name}</span>
                                    <span className={`status-pill ${mangueraAsignada ? 'ok' : 'pendiente'}`}>
                                        {mangueraAsignada ? 'Asignada' : 'Asignar'}
                                    </span>
                                </li>
                            );
                        } else {
                            const estado = statusTable[part.key];
                            // Mapear a clases visuales definidas en Recepcion.css
                            const pillClass = estado ? (estado === 'bien' ? 'verde' : estado === 'atencion' ? 'naranja' : 'rojo') : 'pendiente';
                            const pillText = estado ? (estado === 'bien' ? 'OK' : estado === 'atencion' ? 'Atención' : 'Falla') : 'Pendiente';
                            return (
                                <li key={part.key} className="summary-item" onClick={() => handleOpenInspection(part.key)}>
                                    <span>{part.name}</span>
                                    <span className={`status-pill ${pillClass}`}>
                                        {pillText}
                                    </span>
                                </li>
                            );
                        }
                    })}
                    <li className="summary-item" onClick={toggleChecklistDialog}>
                        <span><FaClipboardList style={{ marginRight: '8px' }} />Checklist Completo</span>
                    </li>
                </ul>

                <button
                    className="btn-primary"
                    style={{ marginTop: "auto" }}
                    onClick={handleSubmit}
                    disabled={loading || completedParts < totalParts}
                >
                    {loading ? 'Guardando...' : 'Finalizar y Continuar'}
                </button>
            </aside>
            {showInspectionDialog && currentInspection && (
                <>
                    <div className="modal-overlay" onClick={closeInspectionDialog}></div>
                    <div className="part-form">
                        <button className="close-modal" onClick={closeInspectionDialog}>×</button>
                        <h3>{partsMapping.find(p => p.key === currentInspection)?.name}</h3>
                        {(currentInspection === "mangueraCal" || currentInspection === "mangueraAire") && (
                            <div className="manguera-info">
                                {(() => {
                                    const tipoManguera = currentInspection === "mangueraCal" ? "cal" : "aire";
                                    const manguera = obtenerMangueraAsignada(tipoManguera);
                                    if (!manguera) return <div className="alert-message">No hay datos para esta manguera.</div>;

                                    const estado = obtenerEstadoManguera(manguera.horas_uso_actual, manguera.vida_util_horas);
                                    return (
                                        <div className={`info-card ${estado.nivel}`}>
                                            <h4>Información de la Manguera</h4>
                                            <p><strong>Código:</strong> {manguera.codigo_manguera}</p>
                                            <p><strong>Horas de uso:</strong> {Math.round(manguera.horas_uso_actual)} / {manguera.vida_util_horas}</p>
                                            <p><strong>Estado:</strong> {estado.mensaje}</p>
                                            {estado.nivel === 'alerta' && (
                                                <div className="alert-message">
                                                    <FaExclamationTriangle />
                                                    <span>Programar cambio próximamente</span>
                                                </div>
                                            )}
                                            {estado.nivel === 'critico' && (
                                                <div className="critical-message">
                                                    <FaExclamationTriangle />
                                                    <span>CAMBIO INMEDIATO REQUERIDO</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        {renderInspectionOptions()}

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={confirmInspectionResult}
                                disabled={
                                    (() => {
                                        switch (currentInspection) {
                                            case "abrazaderas":
                                                return !(abrazaderasChecks.colocada && abrazaderasChecks.asegurada && abrazaderasChecks.estado);
                                            case "seguridad":
                                                return !(seguridadChecks.cadenas && seguridadChecks.boton && seguridadChecks.confinamiento);
                                            case "mangueraCal":
                                                return !puedeUsarManguera("cal");
                                            case "mangueraAire":
                                                return !puedeUsarManguera("aire");
                                            default:
                                                return !inspectionResult;
                                        }
                                    })()
                                }
                            >
                                Confirmar
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={closeInspectionDialog}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </>
            )}
            {showChecklistDialog && (
                <ChecklistBModal
                    checklistB={checklistB}
                    setChecklistB={setChecklistB}
                    onClose={toggleChecklistDialog}
                />
            )}
            {showMangueraSelector && (
                <>
                    <div className="modal-overlay" onClick={() => setShowMangueraSelector(false)}></div>
                    <div className="modal-form">
                        <div className="modal-header">
                            <h3>Asignar Manguera de {tipoMangueraParaAsignar === 'cal' ? 'Cal' : 'Aire'}</h3>
                            <button className="close-modal" onClick={() => setShowMangueraSelector(false)}>×</button>
                        </div>
                        <div className="manguera-selector-list">
                            {manguerasDisponibles
                                .filter(m => m.tipo_manguera.toLowerCase().includes(tipoMangueraParaAsignar))
                                .map(manguera => {
                                    const porcentajeUso = manguera.vida_util_horas > 0
                                        ? Math.round((manguera.horas_uso_actual / manguera.vida_util_horas) * 100)
                                        : 0;
                                    return (
                                        <div key={manguera.id} className="manguera-selector-item" onClick={() => handleAsignarManguera(manguera)}>

                                            <div className="manguera-item-info">
                                                <strong>{manguera.codigo_manguera}</strong>
                                                <span>({Math.round(manguera.horas_uso_actual)} / {manguera.vida_util_horas}h)</span>
                                            </div>

                                            <div className="manguera-item-progress">
                                                <div className="progress-bar-container">
                                                    <div
                                                        className="progress-bar-fill"
                                                        style={{ width: `${porcentajeUso}%` }}
                                                    ></div>
                                                </div>
                                                <span className="progress-percentage">{porcentajeUso}%</span>
                                            </div>

                                        </div>
                                    );
                                })
                            }

                            {/* Esta parte es para mostrar un mensaje si la lista está vacía */}
                            {manguerasDisponibles.filter(m => m.tipo_manguera.toLowerCase().includes(tipoMangueraParaAsignar)).length === 0 && (
                                <div className="alert alert-warning">No hay mangueras de este tipo disponibles.</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

export const InspeccionBScene = ({ statusTable, onNodesLoaded }) => {
    return (
        <>
            <OrbitControls
                enableRotate={false}
                enablePan={false}
                enableZoom={false}
            />
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
            <Suspense fallback={null}>
                <EscenaCamion
                    modeloVisualPath={RUTA_MODELO_VISUAL_GLB}
                    modeloAnimacionPath={RUTA_MODELO_ANIMACION_GLB}
                    nombreAnimacionActiva={"descarga"}
                    onNodesLoaded={onNodesLoaded}
                    statusTable={statusTable}
                />
            </Suspense>
        </>
    );
} 