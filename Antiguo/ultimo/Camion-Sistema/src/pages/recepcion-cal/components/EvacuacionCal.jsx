"use client"

import { useState, useCallback, useMemo, Suspense, useRef, useEffect } from "react"
import { useProcesoCamion } from "../../../context/ProcesoCamionContext"
import { FaArrowRight, FaTruck, FaHourglass, FaCheckCircle } from "react-icons/fa"
import { registrarEvacuacion, logActivity as logApiActivity } from "../../../services/api"
import { useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import { Vector3, LoopOnce } from "three"
import { useAuth } from '../../../context/AuthContext';
import { manguerasApi } from "../../../services/manguerasAPI";
import { useNavigate } from "react-router-dom"
import "../../../styles/evacuacioncal.css"

// 🔹 Helper para generar URL válida en dev (http://) y Electron (file://)
const asset = (relPath) => new URL(relPath, window.location.href).toString();

// 🔹 Rutas de modelos (OJO: usar "./" y no "/")
const RUTA_MODELO_VISUAL_GLB = asset("./modelo/Silo2.glb");
const RUTA_MODELO_ANIMACION_GLB = asset("./modelo/a05(carga4f).glb");

// 🔹 Precarga de modelos para evitar parpadeos
useGLTF.preload(RUTA_MODELO_VISUAL_GLB);
useGLTF.preload(RUTA_MODELO_ANIMACION_GLB);

// === Componente de Escena Reutilizable ===
function EscenaCamion({
    modeloVisualPath,
    modeloAnimacionPath,
    visiblePartsProp,
    onNodesLoaded,
    onAnimationsLoaded,
    escalaGeneral = 1,
    partsToHide = [],
    activeCameraName,
    nombreAnimacionActiva,
    onAnimationEnd
}) {
    const { scene: escenaVisual, nodes: nodosVisuales, cameras: camarasVisual } = useGLTF(modeloVisualPath)
    const { animations: animacionesDelArchivo } = useGLTF(modeloAnimacionPath)
    const { actions, mixer } = useAnimations(animacionesDelArchivo, escenaVisual)

    const materialsCloned = useRef(false)
    const { camera: mainCam, controls, gl } = useThree()

    useEffect(() => {
        if (nodosVisuales && onNodesLoaded) onNodesLoaded(Object.keys(nodosVisuales))
        if (animacionesDelArchivo && onAnimationsLoaded) onAnimationsLoaded(animacionesDelArchivo.map(a => a.name))
    }, [nodosVisuales, animacionesDelArchivo, onNodesLoaded, onAnimationsLoaded])

    useEffect(() => {
        if (nodosVisuales) {
            for (const nodeName in nodosVisuales) {
                const node = nodosVisuales[nodeName]
                if (node && typeof node.visible === 'boolean') {
                    node.visible = !partsToHide.includes(nodeName)
                }
            }
        }
    }, [nodosVisuales, partsToHide])

    useEffect(() => {
        if (escenaVisual && !materialsCloned.current) {
            escenaVisual.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone()
                }
            })
            materialsCloned.current = true
        }
    }, [escenaVisual])

    useEffect(() => {
        if (activeCameraName && camarasVisual && camarasVisual.length > 0) {
            const targetGlbCamera = camarasVisual.find(cam => cam.name === activeCameraName)
            if (targetGlbCamera) {
                mainCam.position.copy(targetGlbCamera.position)
                mainCam.quaternion.copy(targetGlbCamera.quaternion)
                if (targetGlbCamera.isPerspectiveCamera) {
                    mainCam.fov = targetGlbCamera.fov
                    mainCam.near = targetGlbCamera.near
                    mainCam.far = targetGlbCamera.far
                }
                mainCam.updateProjectionMatrix()
                if (controls) {
                    const lookAtPoint = new Vector3(0, 0, -1)
                    lookAtPoint.applyQuaternion(mainCam.quaternion)
                    lookAtPoint.add(mainCam.position)
                    controls.target.copy(lookAtPoint)
                    controls.update()
                }
            }
        }
    }, [activeCameraName, camarasVisual, mainCam, controls, gl])

    useEffect(() => {
        console.log(`[EscenaCamion] Verificando animación. Recibido: '${nombreAnimacionActiva}'. Acciones disponibles:`, actions ? Object.keys(actions) : 'ninguna');
        if (nombreAnimacionActiva && actions && actions[nombreAnimacionActiva]) {
            const action = actions[nombreAnimacionActiva]
            console.log(`[EscenaCamion] REPRODUCIENDO animación: ${nombreAnimacionActiva}`);
            action.reset();
            action.setLoop(LoopOnce)
            action.clampWhenFinished = true
            action.play();

            const handleFinished = () => {
                if (onAnimationEnd) onAnimationEnd()
            }
            mixer.addEventListener('finished', handleFinished)
            return () => {
                mixer.removeEventListener('finished', handleFinished)
            }
        } else {
            console.log(`[EscenaCamion] No se pudo reproducir '${nombreAnimacionActiva}'. Causa: Nombre de animación nulo, acciones no cargadas o animación no encontrada.`);
        }
    }, [actions, mixer, nombreAnimacionActiva, animacionesDelArchivo, onAnimationEnd])

    return <primitive object={escenaVisual} scale={escalaGeneral} />
}

// === Componente UI Principal ===
export const EvacuacionCalUI = ({ setAnimacionEvacuacion, onFinalizar }) => {
    const navigate = useNavigate()
    const { camionActual, avanzarEtapa, comentarios, setComentarios, ensureLockOrExplain, releaseLock } = useProcesoCamion()
    const { user } = useAuth()
    const [tiempoEvacuacion, setTiempoEvacuacion] = useState("")
    const [observaciones, setObservaciones] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [evacuacionCompletada, setEvacuacionCompletada] = useState(false)
    const [mostrarBotonContinuar, setMostrarBotonContinuar] = useState(false)
    const [modalOpen, setModalOpen] = useState(false);
    const [modalReady, setModalReady] = useState(false);

    const handleTiempoChange = (e) => setTiempoEvacuacion(e.target.value)
    const handleObservacionesChange = (e) => setObservaciones(e.target.value)

    const handleEvacuacionCompletada = async () => {
        if (!(await ensureLockOrExplain())) {
            navigate('/recepcion-cal');
            return;
        }
        const t = Math.max(0, Number(tiempoEvacuacion) || 0);

        try {
            await registrarEvacuacion({
                proceso_id: camionActual.id,
                tiempo: t,
                observaciones: (observaciones || '').trim(),
                usuario_id: user.id,
                completada: true
            });

            await logApiActivity("EVACUACION_COMPLETADA", {
                proceso_id: camionActual.id,
                patente: camionActual.patente,
                tiempo_evacuacion: t
            });
            setEvacuacionCompletada(true);
            setModalOpen(true);
            setModalReady(false);

            if (setAnimacionEvacuacion) setAnimacionEvacuacion('salida');

            const onDone = () => setModalReady(true);
            window.addEventListener('evacuacion-animacion-salida-finalizada', onDone, { once: true });

        } catch (error) {
            console.error("Error al completar la descarga:", error);
            alert("Error al completar la descarga. Por favor, inténtelo de nuevo.");
        }
    };


    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (isSubmitting) return;

        // si perdiste el lock, vuelve a recepción
        if (!(await ensureLockOrExplain())) {
            navigate('/recepcion-cal');
            return;
        }

        setIsSubmitting(true);
        try {
            // tiempo saneado y derivado a horas de uso
            const t = Math.max(0, Number(tiempoEvacuacion) || 0);
            const horasDeUso = t / 60;

            // registra uso de mangueras (si corresponde)
            if (horasDeUso > 0 && camionActual?.id) {
                const manguerasDelProceso = await manguerasApi
                    .obtenerManguerasPorCamion(camionActual.id)
                    .catch(() => []);
                if (manguerasDelProceso?.length) {
                    await Promise.all(
                        manguerasDelProceso.map(m =>
                            manguerasApi.registrarUsoManguera(m.id, camionActual.id, horasDeUso)
                        )
                    );
                }
            }

            await logApiActivity('REGISTRO_DESCARGA_CAL', {
                proceso_id: camionActual.id,
                patente: camionActual.patente,
                horas_de_uso: horasDeUso,
                tiempo_evacuacion: t
            });

            // libera lock en best-effort y navega
            try { await releaseLock?.(); } catch (_) { }
            navigate('/recepcion-cal', { replace: true });

        } catch (error) {
            console.error("Error al guardar la descarga:", error);
            alert("Error al guardar la descarga. Por favor, inténtelo de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="evacuacion-cal-container">
            <div className="evacuacion-header">
                <h2>Descarga de Cal - Camión {camionActual?.patente}</h2>
                <p>Registre los detalles de la descarga de cal del camión.</p>
            </div>

            <div className="evacuacion-content">
                {modalOpen && (
                    <div className="modal-backdrop" role="dialog" aria-modal="true">
                        <div className="modal-card">
                            <FaCheckCircle className="modal-icon" />
                            <h2 className="modal-title">Descarga registrada</h2>
                            {!modalReady ? (
                                <div className="modal-pulse" aria-hidden="true" />
                            ) : (
                                <button
                                    type="button"
                                    className="btn-guardar"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Guardando..." : "Volver a Recepción"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="form-section">
                    <h3>Información de Descarga</h3>

                    <div className="form-group">
                        <label htmlFor="tiempo">Tiempo de Descarga (minutos):</label>
                        <input
                            type="number"
                            id="tiempo"
                            value={tiempoEvacuacion}
                            onChange={handleTiempoChange}
                            placeholder="Ingrese el tiempo en minutos"
                            min="0"
                            disabled={evacuacionCompletada}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="observaciones">Observaciones:</label>
                        <textarea
                            id="observaciones"
                            value={observaciones}
                            onChange={handleObservacionesChange}
                            placeholder="Agregue observaciones sobre la descarga..."
                            rows="4"
                            disabled={evacuacionCompletada}
                        />
                    </div>
                </div>

                <div className="action-section">
                    <div className="action-buttons">
                        {!evacuacionCompletada ? (
                            <button
                                type="button"
                                className="btn-completar-evacuacion"
                                onClick={handleEvacuacionCompletada}
                                disabled={isSubmitting || !tiempoEvacuacion}
                            >
                                <FaCheckCircle />
                                Registrar Descarga
                            </button>
                        ) : (
                            <>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// === Componente de Escena 3D ===
export const EvacuacionCalScene = ({
    animacionEvacuacion,
    setNodos,
    setAnims,
    partesAOcultar,
}) => {
    const [nodos, setNodosLocal] = useState(null)
    const [anims, setAnimsLocal] = useState([])

    const handleNodesLoaded = useCallback((nodosCargados) => {
        console.log("[EvacuacionCalScene] Nodos cargados:", nodosCargados)
        setNodosLocal(nodosCargados)
        if (setNodos) setNodos(nodosCargados)
    }, [setNodos])

    const handleAnimationsLoaded = useCallback((animacionesCargadas) => {
        console.log("[EvacuacionCalScene] Animaciones cargadas:", animacionesCargadas)
        setAnimsLocal(animacionesCargadas)
        if (setAnims) setAnims(animacionesCargadas)
    }, [setAnims])

    const nombreAnimacionActiva = useMemo(() => {
        return animacionEvacuacion || null
    }, [animacionEvacuacion])

    return (
        <>
            <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
            <ambientLight intensity={1.2} />
            <directionalLight position={[10, 10, 10]} intensity={2.0} castShadow />
            <Suspense fallback={null}>
                <EscenaCamion
                    modeloVisualPath={RUTA_MODELO_VISUAL_GLB}
                    modeloAnimacionPath={RUTA_MODELO_ANIMACION_GLB}
                    onNodesLoaded={handleNodesLoaded}
                    onAnimationsLoaded={handleAnimationsLoaded}
                    nombreAnimacionActiva={nombreAnimacionActiva}
                    partsToHide={partesAOcultar}
                    escalaGeneral={1}
                    activeCameraName="Camera"
                    onAnimationEnd={() => {
                        try {
                            window.dispatchEvent(new CustomEvent('evacuacion-animacion-salida-finalizada'))
                        } catch (e) {
                            // noop
                        }
                    }}
                />
            </Suspense>
        </>
    )
}
