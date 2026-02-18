"use client"

import { useState, useCallback, useMemo, Suspense, useRef, useEffect } from "react"
import { useProcesoCamion } from "../../context/ProcesoCamionContext"
import { FaArrowRight, FaTruck, FaHourglass, FaCheckCircle } from "react-icons/fa"
import { registrarEvacuacion, logActivity as logApiActivity } from "../../services/api"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei"
import { Vector3, LoopOnce } from "three"
import { useAuth } from '../../context/AuthContext';
import { manguerasApi } from "../../services/manguerasAPI";


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
  nombreAnimacionActiva
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

  // CORRECCIÓN: Simplificar la lógica de animación como en PesajeInicial
  useEffect(() => {
    console.log(`[EscenaCamion] Verificando animación. Recibido: '${nombreAnimacionActiva}'. Acciones disponibles:`, actions ? Object.keys(actions) : 'ninguna');
    if (nombreAnimacionActiva && actions && actions[nombreAnimacionActiva]) {
      const action = actions[nombreAnimacionActiva]
      console.log(`[EscenaCamion] REPRODUCIENDO animación: ${nombreAnimacionActiva}`);
      action.reset();
      action.setLoop(LoopOnce)
      action.clampWhenFinished = true
      action.play();
      // Log para debug
      console.log(`[EvacuacionCal] Reproduciendo animación: ${nombreAnimacionActiva}`)
    } else {
      console.log(`[EscenaCamion] No se pudo reproducir '${nombreAnimacionActiva}'. Causa: Nombre de animación nulo, acciones no cargadas o animación no encontrada.`);
    }
  }, [actions, mixer, nombreAnimacionActiva, animacionesDelArchivo])

  return <primitive object={escenaVisual} scale={escalaGeneral} />
}

export const EvacuacionCalUI = ({ setAnimacionEvacuacion, onFinalizar }) => {
  const { camionActual } = useProcesoCamion()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [evacuacionCompletada, setEvacuacionCompletada] = useState(false)
  const [tiempoEvacuacion, setTiempoEvacuacion] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const { logActivity } = useAuth();
  const { user } = useAuth();

  const handleTiempoChange = (e) => setTiempoEvacuacion(e.target.value)
  const handleObservacionesChange = (e) => setObservaciones(e.target.value)

  const handleEvacuacionCompletada = async () => {
    try {
      setLoading(true)
      setError(null)
      await registrarEvacuacion({
        proceso_id: camionActual?.id,
        completada: true,
        tiempo: Number.parseInt(tiempoEvacuacion, 10),
        observaciones,
        usuario_id: user?.id
      })
      setEvacuacionCompletada(true)
    } catch (err) {
      console.error("Error al registrar la evacuación:", err)
      setError("Error al registrar la evacuación. Por favor, intente nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!evacuacionCompletada) {
      setError("Debe completar la evacuación antes de continuar.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const horasDeUso = Number(tiempoEvacuacion) / 60;

      if (horasDeUso > 0) {
        console.log("Buscando mangueras para el proceso ID:", camionActual.id);
        const manguerasDelProceso = await manguerasApi.obtenerManguerasPorCamion(camionActual.id);
        console.log("Mangueras encontradas para este proceso:", manguerasDelProceso);

        if (manguerasDelProceso && manguerasDelProceso.length > 0) {
          const promesasDeActualizacion = manguerasDelProceso.map(manguera =>
            manguerasApi.registrarUsoManguera(manguera.id, camionActual.id, horasDeUso)
          );
          await Promise.all(promesasDeActualizacion);
          console.log(`Llamada a la API para actualizar ${manguerasDelProceso.length} manguera(s) realizada.`);
        } else {
          console.warn("ADVERTENCIA: No se encontraron mangueras asignadas a este proceso para actualizar las horas.");
        }
      }

      await logApiActivity('REGISTRO_DESCARGA_CAL', {
        procesoId: camionActual?.id,
        patente: camionActual?.patente,
        tiempo: tiempoEvacuacion,
        observaciones: observaciones,
      });
      setAnimacionEvacuacion("salida");
      console.log('[EvacuacionCal] Activando animación de salida');

      setTimeout(() => {
        if (onFinalizar) {
          onFinalizar();
        }
      }, 3000);

    } catch (err) {
      console.error("Error al procesar la solicitud:", err);
      setError("Error al procesar la solicitud. Por favor, intente nuevamente.");
      setLoading(false);
    }
  };

  return (
    <div className="evacuacion-container">
      <h2>Descarga de Cal</h2>
      <p>
        Registre la descarga de cal para el camión con patente <strong>{camionActual.patente}</strong>.
      </p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="evacuacion-form">
        <div className="form-group">
          <label htmlFor="tiempoEvacuacion">
            <FaHourglass /> Tiempo de Descarga (minutos):
          </label>
          <input
            type="number"
            id="tiempoEvacuacion"
            value={tiempoEvacuacion}
            onChange={handleTiempoChange}
            min="1"
            disabled={loading || evacuacionCompletada}
          />
        </div>

        <div className="form-group">
          <label htmlFor="observaciones">Observaciones:</label>
          <textarea
            id="observaciones"
            value={observaciones}
            onChange={handleObservacionesChange}
            placeholder="Ingrese observaciones sobre la evacuación (opcional)"
            disabled={loading || evacuacionCompletada}
          />
        </div>

        {!evacuacionCompletada ? (
          <button
            type="button"
            className="btn-primary"
            onClick={handleEvacuacionCompletada}
            disabled={loading || !tiempoEvacuacion}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                <span>Registrando...</span>
              </>
            ) : (
              <span>Registrar Evacuación</span>
            )}
          </button>
        ) : (
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner-small"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>Continuar a Pesaje Final</span>
                  <FaArrowRight />
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

export const EvacuacionCalScene = ({
  animacionEvacuacion,
  setNodos,
  setAnims,
  partesAOcultar,
}) => {
  console.log(`[EvacuacionCalScene] Renderizando con animacionEvacuacion: ${animacionEvacuacion}`);
  const RUTA_MODELO_VISUAL_GLB = "/modelo/Silo2.glb";
  const RUTA_MODELO_ANIMACION_GLB = "/modelo/a05(carga4f).glb";
  const ESCALA_GENERAL = 1.0;

  // CORRECCIÓN: Agregar callbacks para manejar nodos y animaciones
  const handleNodesLoaded = useCallback((nodeKeys) => {
    if (setNodos) setNodos(nodeKeys);
  }, [setNodos]);

  const handleAnimationsLoaded = useCallback((animNames) => {
    if (setAnims) setAnims(animNames);
    console.log(`[EvacuacionCal] Animaciones disponibles:`, animNames);
  }, [setAnims]);

  return (
    <>
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 10]} intensity={2.5} castShadow />
      <Suspense fallback={null}>
        <EscenaCamion
          modeloVisualPath={RUTA_MODELO_VISUAL_GLB}
          modeloAnimacionPath={RUTA_MODELO_ANIMACION_GLB}
          escalaGeneral={ESCALA_GENERAL}
          partsToHide={partesAOcultar}
          onNodesLoaded={handleNodesLoaded}
          onAnimationsLoaded={handleAnimationsLoaded}
          activeCameraName="Camera"
          nombreAnimacionActiva={animacionEvacuacion}
        />
      </Suspense>
    </>
  );
};