"use client"

import { useState, useEffect, Suspense, useMemo, useCallback, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { useProcesoCamion } from "../../context/ProcesoCamionContext"
import { FaWeightHanging, FaArrowRight, FaExclamationTriangle } from "react-icons/fa"
import { guardarPesajeInicial, logActivity as logApiActivity } from "../../services/api"
import { useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations, Bounds } from "@react-three/drei"
import { Vector3, LoopOnce } from "three"
import { useAuth } from "../../context/AuthContext"
import { useNavigate } from "react-router-dom";


// Componente para la escena 3D
function EscenaCamion({
  modeloVisualPath,
  modeloAnimacionPath,
  onNodesLoaded,
  onAnimationsLoaded,
  escalaGeneral = 1,
  partsToHide = [],
  activeCameraName,
  nombreAnimacionActiva,
}) {
  const { scene: escenaVisual, nodes: nodosVisuales, cameras: camarasVisual } = useGLTF(modeloVisualPath)
  const { animations: animacionesDelArchivo } = useGLTF(modeloAnimacionPath)
  const { actions, mixer } = useAnimations(animacionesDelArchivo, escenaVisual)
  const materialsCloned = useRef(false)
  const { camera: mainCam, controls, gl } = useThree()

  useEffect(() => {
    if (nodosVisuales && onNodesLoaded) {
      onNodesLoaded(Object.keys(nodosVisuales))
    }
    if (animacionesDelArchivo && onAnimationsLoaded) {
      onAnimationsLoaded(animacionesDelArchivo.map((a) => a.name))
    }
  }, [nodosVisuales, animacionesDelArchivo, onNodesLoaded, onAnimationsLoaded])

  useEffect(() => {
    if (nodosVisuales) {
      for (const nodeName in nodosVisuales) {
        const node = nodosVisuales[nodeName]
        if (node && typeof node.visible === "boolean") {
          node.visible = !partsToHide.includes(nodeName)
        }
      }
    }
  }, [nodosVisuales, partsToHide])

  useEffect(() => {
    if (escenaVisual && !materialsCloned.current) {
      escenaVisual.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone()
        }
      })
      materialsCloned.current = true
    }
  }, [escenaVisual])

  useEffect(() => {
    if (activeCameraName && camarasVisual && camarasVisual.length > 0) {
      const targetGlbCamera = camarasVisual.find((cam) => cam.name === activeCameraName)
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
    if (nombreAnimacionActiva && actions && actions[nombreAnimacionActiva]) {
      const action = actions[nombreAnimacionActiva]
      action.reset()
      action.setLoop(LoopOnce)
      action.clampWhenFinished = true
      action.play()
    }
  }, [actions, mixer, nombreAnimacionActiva, animacionesDelArchivo])

  return <primitive object={escenaVisual} scale={escalaGeneral} />
}

const asset = (relPath) => new URL(relPath, window.location.href).toString();
const RUTA_MODELO_VISUAL_GLB = asset("./modelo/Pesaje.glb");
const RUTA_MODELO_ANIMACION_GLB = asset("./modelo/a03(pesaje).glb");
useGLTF.preload(RUTA_MODELO_VISUAL_GLB);
useGLTF.preload(RUTA_MODELO_ANIMACION_GLB);
// Componente de la escena 3D separado
export const PesajeInicialScene = () => {
  const [nombresDeNodos, setNombresDeNodos] = useState([])
  const [nombresDeAnimaciones, setNombresDeAnimaciones] = useState([])


  const ESCALA_GENERAL_MODELO = 1.0
  const NOMBRE_ANIMACION_LLEGADA = "llegada"
  const partesAOcultar = useMemo(() => [], [])

  const handleNodesLoaded = useCallback((nodeKeys) => {
    setNombresDeNodos(nodeKeys)
  }, [])

  const handleAnimationsLoaded = useCallback((animNames) => {
    setNombresDeAnimaciones(animNames)
    console.log(`[PesajeInicial] Animaciones disponibles:`, animNames)
  }, [])

  return (
    <>
      <OrbitControls makeDefault enablePan enableZoom enableRotate
        minDistance={8} maxDistance={80} />

      <ambientLight intensity={1.5} />
      <directionalLight
        position={[30, 40, 30]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <directionalLight position={[-30, 20, -20]} intensity={0.8} />

      <Suspense fallback={null}>
        <Bounds fit observe clip margin={1.15}>
          <EscenaCamion
            modeloVisualPath={RUTA_MODELO_VISUAL_GLB}
            modeloAnimacionPath={RUTA_MODELO_ANIMACION_GLB}
            partsToHide={partesAOcultar}
            onNodesLoaded={handleNodesLoaded}
            onAnimationsLoaded={handleAnimationsLoaded}
            escalaGeneral={ESCALA_GENERAL_MODELO}
            nombreAnimacionActiva={NOMBRE_ANIMACION_LLEGADA}
          />
        </Bounds>
      </Suspense>
    </>
  )
}

// Componente UI del formulario
export const PesajeInicialUI = () => {
  const { user } = useAuth()
  const { camionActual, pesoBruto, setPesoBruto, finalizarProceso, ensureLockOrExplain, releaseLock } = useProcesoCamion()
  const navigate = useNavigate();
  const procesoId = camionActual?.id
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showErrorModal, setShowErrorModal] = useState(false);
  const handlePesoChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "")
    setPesoBruto(value ? Number(value) : 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(await ensureLockOrExplain())) { navigate("/pesaje"); return; }
    console.log("[PesajeInicial] Iniciando guardado de pesaje inicial...");
    console.log("[PesajeInicial] Camión actual:", camionActual);

    if (!pesoBruto || pesoBruto <= 0) {
      setError("Por favor, ingrese un peso bruto válido mayor a 0 kg.");
      setShowErrorModal(true);
      return;
    }
    const pesoGuia = camionActual?.peso_guia || 0;
    if (pesoGuia > 0 && pesoBruto <= pesoGuia) {
      setError("Alerta: El peso bruto no puede ser menor o igual al peso neto de la guía.");
      setShowErrorModal(true);
      return;
    }
    const pesoBrutoOcr = camionActual?.peso_guia_bruto;
    const TOLERANCIA_OCR = 150;
    if (pesoBrutoOcr && pesoBrutoOcr > 0) {
      const diferenciaConOcr = Math.abs(pesoBruto - pesoBrutoOcr);
      if (diferenciaConOcr > TOLERANCIA_OCR) {
        setError(
          `El peso ingresado (${pesoBruto} kg) difiere del peso OCR (${pesoBrutoOcr} kg) en ${diferenciaConOcr.toFixed(0)} kg, superando la tolerancia de ${TOLERANCIA_OCR} kg. Por favor, verifique.`
        );
        setShowErrorModal(true);
        return;
      }
    }
    const diferencia = pesoBruto - pesoGuia;
    const porcentajeDiferencia = pesoGuia > 0 ? (diferencia / pesoGuia) * 100 : 0;
    const payload = {
      proceso_id: camionActual?.id,
      tipo: "inicial",
      peso_kg: pesoBruto,
      diferencia: diferencia,
      porcentaje_diferencia: porcentajeDiferencia,
      usuario_id: user?.id,
    };

    console.log("[PesajeInicial] Payload para guardar pesaje:", payload);

    try {
      setLoading(true);
      setError(null);

      console.log("[PesajeInicial] Llamando a guardarPesajeInicial...");
      const resultado = await guardarPesajeInicial(payload);
      console.log("[PesajeInicial] Resultado del guardado:", resultado);

      console.log("[PesajeInicial] Llamando a logActivity...");
      await logApiActivity("REGISTRO_PESAJE_INICIAL", {
        procesoID: camionActual?.id,
        patente: camionActual?.patente,
        peso: pesoBruto,
        diferencia: diferencia,
      });
      try { await releaseLock(); } catch { }
      console.log("[PesajeInicial] Pesaje inicial guardado exitosamente. Llamando a finalizarProceso()...");
      // Después del pesaje inicial, volver a la lista para que el proceso aparezca en Recepción Cal
      finalizarProceso();
      console.log("[PesajeInicial] finalizarProceso() ejecutado. Proceso debería desaparecer de Pesaje y aparecer en Recepción Cal.");
    } catch (err) {
      console.error("[PesajeInicial] Error al guardar el pesaje inicial:", err);
      setError("Error al guardar el pesaje. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pesaje-info">
      <h2>Pesaje Inicial</h2>
      <p>
        Ingrese el <strong>peso bruto</strong> del camión con patente{" "}
        <strong>{camionActual?.patente || "CARGANDO..."}</strong>.
      </p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="pesaje-form">
        <div className="form-group">
          <label htmlFor="pesoBruto">
            <FaWeightHanging /> Peso Bruto (kg):
          </label>
          <input
            type="text"
            id="pesoBruto"
            value={pesoBruto === 0 ? "" : pesoBruto}
            onChange={handlePesoChange}
            placeholder="Ingrese un peso bruto válido"
            required
            disabled={loading}
            pattern="[0-9]*"
            inputMode="numeric"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner-small"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>Continuar</span>
                <FaArrowRight />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="pesaje-guia">
        <h3>Información de Referencia</h3>
        <p>
          <strong>Peso Neto según guía:</strong>
          <span>{camionActual?.peso_guia || "No registrado"} kg</span>
        </p>
        <p>
          <strong>Peso Bruto según Guía (OCR):</strong>
          <span>{camionActual?.peso_guia_bruto || "N/A"} kg</span>
        </p>
        <p>
          <strong>Diferencia con guía:</strong>
          <span
            className={
              camionActual?.peso_guia && typeof pesoBruto === "number" && pesoBruto > 0
                ? pesoBruto - camionActual.peso_guia >= 0
                  ? "positivo"
                  : "negativo"
                : ""
            }
          >
            {camionActual?.peso_guia && typeof pesoBruto === "number" && pesoBruto > 0
              ? `${(pesoBruto - camionActual.peso_guia).toFixed(2)} kg (${(
                ((pesoBruto - camionActual.peso_guia) / camionActual.peso_guia) * 100
              ).toFixed(2)}%)`
              : "No se puede calcular"}
          </span>
        </p>
      </div>
      {showErrorModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowErrorModal(false)}></div>
          <div className="alert-modal">
            <div className="alert-modal-header">
              <FaExclamationTriangle />
              <h3>Error de Validación</h3>
            </div>
            <div className="alert-modal-body">
              <p>{error}</p>
            </div>
            <div className="alert-modal-footer">
              <button className="btn-primary" onClick={() => setShowErrorModal(false)}>
                Entendido
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
