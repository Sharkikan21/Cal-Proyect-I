"use client"

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react"
import { useProcesoCamion } from "../../context/ProcesoCamionContext"
import { guardarPesajeFinal, enviarAlertaCal, finalizarProcesoCompleto, logActivity as logApiActivity } from "../../services/api"
import { useAuth } from '../../context/AuthContext';
import { FaWeightHanging, FaArrowRight, FaExclamationTriangle } from "react-icons/fa"
import { useThree } from "@react-three/fiber"
import { OrbitControls, useGLTF, useAnimations, Bounds } from "@react-three/drei"
import { Vector3, LoopOnce } from "three"
import { manguerasApi } from "../../services/manguerasAPI";
import { useNavigate } from "react-router-dom";

function Modal({ open, title, message, onClose }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div style={{
        width: "min(520px, 92vw)", background: "#fff", borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)", padding: 24
      }}>
        <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
        <p style={{ marginTop: 12, whiteSpace: "pre-line" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#111827", color: "#fff" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

const TOLERANCIA_PERMITIDA = 150
const TOLERANCIA_PCT = 1.5;

function EscenaCamion({
  modeloVisualPath,
  modeloAnimacionPath,
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

  useEffect(() => {
    if (nombreAnimacionActiva && actions && actions[nombreAnimacionActiva]) {
      const action = actions[nombreAnimacionActiva]
      action.reset()
      action.setLoop(LoopOnce)
      action.clampWhenFinished = true
      action.play()

      const onFinished = (event) => {
        if (event.action === action) {
        }
      }

      mixer.addEventListener('finished', onFinished)
      return () => {
        mixer.removeEventListener('finished', onFinished)
        action.stop()
      }
    }
  }, [actions, mixer, nombreAnimacionActiva, animacionesDelArchivo])

  return <primitive object={escenaVisual} scale={escalaGeneral} />
}

export const PesajeFinalUI = ({ setAnimacionPesajeFinal }) => {
  const { user } = useAuth();
  const puedeFinalizar = user?.rol === "admin" || user?.rol === "pesaje";
  const {
    camionActual,
    pesoBruto, setPesoBruto,
    pesoTara, setPesoTara,
    finalizarProceso,
    ensureLockOrExplain,
    releaseLock
  } = useProcesoCamion();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pesoGuia, setPesoGuia] = useState(0);
  const [taraEsperada, setTaraEsperada] = useState(0);
  const [difKg, setDifKg] = useState(0);
  const [difPct, setDifPct] = useState(0);
  const [showAlerta, setShowAlerta] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMsg, setModalMsg] = useState("");


  // 1) Cargar neto guía
  useEffect(() => {
    if (camionActual?.peso_guia) setPesoGuia(Number(camionActual.peso_guia));
  }, [camionActual]);

  // 2) Sembrar Bruto desde pesaje inicial (si no venía)
  useEffect(() => {
    if (!pesoBruto && camionActual?.pesajes_registrados?.length) {
      const inicial = camionActual.pesajes_registrados.find(p => p.tipo === "inicial");
      if (inicial?.peso_kg) setPesoBruto(Number(inicial.peso_kg));
    }
  }, [camionActual, pesoBruto, setPesoBruto]);

  // 3) Recalcular tara esperada y diferencia
  useEffect(() => {
    // Tara según guía: si viene `peso_guia_tara`, úsalo; si no, bruto_guia - neto_guia
    const brutoGuia = Number(camionActual?.peso_guia_bruto ?? 0);
    const netoGuia = Number(camionActual?.peso_guia ?? 0);
    const taraGuia = camionActual?.peso_guia_tara != null
      ? Number(camionActual.peso_guia_tara)
      : (brutoGuia && netoGuia ? brutoGuia - netoGuia : null);

    // Si no hay tara guía, usamos la aproximación: tara = bruto(báscula) - neto(guía)
    const taraCalc = (taraGuia != null)
      ? taraGuia
      : ((Number(pesoBruto) || 0) - (Number(netoGuia) || 0));

    setTaraEsperada(Number(taraCalc || 0));

    const taraReal = Number(pesoTara || 0);
    const diffKg = taraReal - Number(taraCalc || 0);
    const pct = (taraCalc && Number(taraCalc) > 0) ? (diffKg / taraCalc) * 100 : 0;

    setDifKg(diffKg);
    setDifPct(pct);
    setShowAlerta(Math.abs(diffKg) >= TOLERANCIA_PERMITIDA || Math.abs(pct) >= TOLERANCIA_PCT);
  }, [pesoBruto, pesoTara, camionActual?.peso_guia, camionActual?.peso_guia_bruto, camionActual?.peso_guia_tara]);

  const handlePesoChange = (e) => {
    const value = Number(e.target.value);
    setPesoTara(Number.isFinite(value) ? value : 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(await ensureLockOrExplain())) { navigate("/pesaje"); return; }
    setError(null);

    if (!puedeFinalizar) {
      setError("Tu rol no puede finalizar pesajes.");
      return;
    }

    const taraNum = Number(pesoTara);
    if (!Number.isFinite(taraNum) || taraNum <= 0) {
      setError("Por favor, ingrese un peso tara válido.");
      return;
    }
    if (Number(pesoBruto || 0) > 0 && taraNum > Number(pesoBruto)) {
      setError("La tara no puede ser mayor que el peso bruto.");
      return;
    }

    const taraEsp = Number(taraEsperada || 0);
    const diffKg = taraNum - taraEsp;
    const diffPct = taraEsp > 0 ? (diffKg / taraEsp) * 100 : 0;
    const fueraTolerancia =
      Math.abs(diffKg) >= TOLERANCIA_PERMITIDA || Math.abs(diffPct) >= TOLERANCIA_PCT;

    // Log helper (no interrumpe si falla)
    const safeLog = (tipo, metadata) => logApiActivity(tipo, metadata).catch(() => { });

    // ----- CASO FUERA DE TOLERANCIA: correo + modal + abortar -----
    if (fueraTolerancia) {
      try {
        await enviarAlertaCal({
          patente: camionActual?.patente,
          peso_real: taraNum,
          peso_bruto: Number(pesoBruto || 0),
          tara_esperada: taraEsp,
          diferencia: diffKg,
        });
        await safeLog("PESAJE_FINAL_ALERTA_ENVIADA", {
          procesoId: camionActual?.id,
          patente: camionActual?.patente,
          taraEsperada: taraEsp,
          taraIngresada: taraNum,
          difKg: diffKg,
          difPct: diffPct,
        });
      } catch (err) {
        await safeLog("PESAJE_FINAL_ALERTA_ERROR", {
          procesoId: camionActual?.id, error: String(err)
        });
      }

      setModalTitle("Tara fuera de tolerancia");
      setModalMsg(
        `La tara ingresada difiere ${Math.abs(diffKg).toFixed(0)} kg (${diffPct.toFixed(2)}%) ` +
        `de la esperada.\n\nSe notificó al supervisor para revisar el proceso. ` +
        `Por favor, regularizar en faena y repetir el pesaje final.`
      );
      setModalOpen(true);
      return; // ← Abortamos: NO finalizamos ni guardamos pesaje final
    }

    // ----- CASO NORMAL: finalizar -----
    setAnimacionPesajeFinal?.("llegada");
    setLoading(true);
    try {
      const pesoNetoReal = Number(pesoBruto || 0) - taraNum;
      const porcentaje_diferencia = taraEsp > 0 ? ((taraNum - taraEsp) / taraEsp) * 100 : 0;

      const payload = {
        peso_tara_kg: taraNum,
        peso_neto_real: Number(pesoNetoReal),
        porcentaje_diferencia,
      };

      await finalizarProcesoCompleto(camionActual.id, payload);
      try { await releaseLock(); } catch { }

      await safeLog("PESAJE_FINAL_GUARDADO_OK", {
        procesoId: camionActual?.id, payload
      });

      finalizarProceso(); // tu flujo/navegación actual
    } catch (err) {
      console.error("Error al finalizar el proceso:", err);
      await safeLog("PESAJE_FINAL_GUARDADO_ERROR", {
        procesoId: camionActual?.id, error: String(err)
      });
      setError("No se pudo finalizar el proceso. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="pesaje-info">
      <h2>Pesaje Final</h2>
      <p>
        Ingrese el <strong>peso tara</strong> del camión con patente{" "}
        <strong>{camionActual?.patente}</strong>.
      </p>

      {!puedeFinalizar && (
        <div className="error-message">
          Tu rol no permite registrar tara final. Solo lectura.
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {showAlerta && (
        <div className="alert-message">
          <FaExclamationTriangle />
          <span>
            Tara ingresada: {Number(pesoTara).toLocaleString()} kg — esperada:{" "}
            {Number(taraEsperada).toLocaleString()} kg. Diferencia:{" "}
            {Number(difKg).toLocaleString()} kg ({difPct.toFixed(2)}%).
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pesaje-form">
        <div className="form-group">
          <label htmlFor="pesoTara">
            <FaWeightHanging /> Peso Tara (kg):
          </label>
          <input
            type="number"
            id="pesoTara"
            value={pesoTara === 0 ? "" : pesoTara}
            onChange={handlePesoChange}
            min="0"
            step="10"
            required
            disabled={loading || !puedeFinalizar}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading || !puedeFinalizar}>
            {loading ? (
              <>
                <div className="spinner-small"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>Finalizar Proceso</span>
                <FaArrowRight />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="pesaje-resumen">
        <h3>Resumen de Pesaje</h3>
        <div className="resumen-item">
          <span>Peso Bruto (Báscula):</span>
          <span>{Number(pesoBruto || 0).toLocaleString()} kg</span>
        </div>
        <div className="resumen-item" style={{ color: "#555", fontStyle: "italic" }}>
          <span>Peso Bruto según Guía (OCR):</span>
          <span>{Number(camionActual?.peso_guia_bruto || 0).toLocaleString()} kg</span>
        </div>
        <div className="resumen-item" style={{ color: "#555", fontStyle: "italic" }}>
          <span>Tara según Guía (OCR):</span>
          <span>{camionActual?.peso_guia_tara != null
            ? Number(camionActual.peso_guia_tara).toLocaleString()
            : "—"} kg</span>
        </div>
        <div className="resumen-item">
          <span>Peso Neto según Guía:</span>
          <span>{Number(pesoGuia || 0).toLocaleString()} kg</span>
        </div>
        <div className="resumen-item">
          <span>Tara esperada:</span>
          <span>{Number(taraEsperada || 0).toLocaleString()} kg</span>
        </div>
        <div className="resumen-item">
          <span>Tara ingresada:</span>
          <span>{Number(pesoTara || 0).toLocaleString()} kg</span>
        </div>
        <div className="resumen-item">
          <span>Diferencia:</span>
          <span>
            {Number(difKg).toLocaleString()} kg ({difPct.toFixed(2)}%)
          </span>
        </div>
      </div>
      <Modal
        open={modalOpen}
        title={modalTitle}
        message={modalMsg}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

const asset = (rel) => new URL(rel, window.location.href).toString();
const RUTA_MODELO_VISUAL_GLB = asset('./modelo/Pesaje.glb');
const RUTA_MODELO_ANIMACION_GLB = asset('./modelo/a03(pesaje).glb');
useGLTF.preload(RUTA_MODELO_VISUAL_GLB);
useGLTF.preload(RUTA_MODELO_ANIMACION_GLB);

export const PesajeFinalScene = ({ animacionPesajeFinal }) => {
  const [nombresDeNodos, setNombresDeNodos] = useState([])
  const [nombresDeAnimaciones, setNombresDeAnimaciones] = useState([])
  const controlsRef = useRef(null)
  const ESCALA_GENERAL_MODELO = 1.0
  const partesAOcultar = useMemo(() => [], [])
  const handleNodesLoaded = useCallback((nodeKeys) => {
    setNombresDeNodos(nodeKeys)
  }, [])
  const handleAnimationsLoaded = useCallback((animNames) => {
    setNombresDeAnimaciones(animNames)
  }, [])

  return (
    <>
      <OrbitControls makeDefault enablePan enableZoom enableRotate minDistance={8} maxDistance={80} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[30, 40, 30]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
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
            nombreAnimacionActiva={animacionPesajeFinal}
          />
        </Bounds>
      </Suspense>
    </>
  )
}