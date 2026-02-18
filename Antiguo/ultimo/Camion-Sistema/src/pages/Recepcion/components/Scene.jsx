// Scene.jsx
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Vector3, Quaternion, LoopOnce } from 'three';
import { asset } from '../../../utils/asset';

const Scene = forwardRef(({
  activeCameraName,
  setNodes,
}, ref) => {

  const TEST_GLTF = asset('./modelo/TEST2.glb');
  const TRUCK_GLTF = asset('./modelo/anim_camion1.glb');
  const BARRIER_GLTF = asset('./modelo/a02(barrera).glb');
  const { scene, nodes: gltfNodes } = useGLTF(TEST_GLTF, true);
  const truckAnimations = useGLTF(TRUCK_GLTF).animations;
  const barrierAnimations = useGLTF(BARRIER_GLTF).animations;

  const allAnimations = useMemo(() => {
    const combined = [];
    if (truckAnimations) combined.push(...truckAnimations);
    if (barrierAnimations) combined.push(...barrierAnimations);
    return combined;
  }, [truckAnimations, barrierAnimations]);

  const { actions } = useAnimations(allAnimations, scene);
  const { camera: mainCam, controls } = useThree();

  const arrivalAnimationPausedAtTarget = useRef(false);
  const truckExitAnimPlaying = useRef(false);
  const truckExitTargetTime = useRef(0);

  // NUEVAS Refs para la animación de la VALLA
  const barrierAnimPlaying = useRef(false);
  const barrierStartTime = useRef(0); // Tiempo de inicio para la valla (frame 106)
  const barrierTargetTime = useRef(0);  // Tiempo final para la valla (frame 190)

  const FRAME_RATE = 24; // Tasa de frames asumida. ¡Verifica que sea correcta para AMBAS animaciones!

  useEffect(() => {
    console.log("🔎 Animaciones disponibles en Scene (combinadas):", Object.keys(actions));
    if (!actions.mov_camion) console.warn("❌ Animación 'mov_camion' NO encontrada.");
    if (!actions.mov_valla) console.warn("❌ Animación 'mov_valla' NO encontrada.");
  }, [actions]);

  useEffect(() => {
    if (gltfNodes) setNodes(gltfNodes);
  }, [gltfNodes, setNodes]);

  const cameraDict = useMemo(() => {
    const dict = {};
    scene.traverse((c) => {
      if (c.type === 'PerspectiveCamera') dict[c.name] = c;
    });
    return dict;
  }, [scene]);

  const currentPos = useRef(new Vector3());
  const currentQuat = useRef(new Quaternion());
  const targetPos = useRef(new Vector3());
  const targetQuat = useRef(new Quaternion());

  useEffect(() => { /* ... tu useEffect para setCam ... */
    window.setCam = (name) => {
      const cam = cameraDict[name];
      if (!cam) { console.warn("❌ Cámara no encontrada:", name); return; }
      targetPos.current.copy(cam.position);
      targetQuat.current.copy(cam.quaternion);
      mainCam.fov = cam.fov; mainCam.near = cam.near; mainCam.far = cam.far;
      mainCam.updateProjectionMatrix();
      console.log(`✅ Cámara cambiada a: ${name}`);
    };
    return () => { delete window.setCam; };
  }, [cameraDict, mainCam]);

  useEffect(() => { /* ... tu useEffect para clonar materiales y cámara ... */
    if (gltfNodes && !gltfNodes.__cloned) {
      Object.values(gltfNodes).forEach((m) => {
        if (m.material) m.material = m.material.clone();
      });
      gltfNodes.__cloned = true;
    }
    const glbCam = cameraDict[activeCameraName];
    if (!glbCam) return;
    targetPos.current.copy(glbCam.position);
    targetQuat.current.copy(glbCam.quaternion);
    mainCam.fov = glbCam.fov; mainCam.near = glbCam.near; mainCam.far = glbCam.far;
    mainCam.updateProjectionMatrix();
  }, [gltfNodes, activeCameraName, cameraDict, mainCam]);

  useImperativeHandle(ref, () => ({
    animarIngresoCamion: () => {
      const arrivalAction = actions["mov_camion"];
      if (arrivalAction) {
        console.log("▶️ SCENE (ref): Ejecutando animarIngresoCamion");
        arrivalAction.reset().setLoop(LoopOnce, 1).time = 0;
        arrivalAction.paused = false;
        arrivalAction.play();
        arrivalAnimationPausedAtTarget.current = false;
      } else { console.warn("❌ SCENE (ref): 'mov_camion' no encontrada para ingreso."); }
    },
    playReturnAnimation: () => { // Esta función ahora maneja la salida exitosa
      console.log("🚚💨 SCENE (ref): Solicitud para playReturnAnimation (salida y valla).");

      const truckAction = actions["mov_camion"];
      const barrierAction = actions["mov_valla"];

      // Configurar animación del CAMIÓN (frames 100-250)
      if (truckAction) {
        const startFrameTruck = 100; const endFrameTruck = 250;
        const startTimeTruck = startFrameTruck / FRAME_RATE;
        truckExitTargetTime.current = endFrameTruck / FRAME_RATE;
        console.log(`▶️ SCENE: Configurando 'mov_camion' para salida: ${startTimeTruck.toFixed(2)}s a ${truckExitTargetTime.current.toFixed(2)}s.`);
        if (arrivalAnimationPausedAtTarget.current && truckAction.paused) {
          console.log("   Deteniendo 'mov_camion' (ingreso pausado) antes de la salida.");
          truckAction.stop();
        }
        truckAction.reset().setLoop(LoopOnce, 1).time = startTimeTruck;
        truckAction.clampWhenFinished = true;
        truckAction.paused = false;
        truckAction.play();
        truckExitAnimPlaying.current = true;
      } else { console.warn("❌ SCENE: 'mov_camion' no encontrada para salida."); }

      // Configurar animación de la VALLA (frames 106-190)
      if (barrierAction) {
        const startFrameBarrier = 106; const endFrameBarrier = 190;
        barrierStartTime.current = startFrameBarrier / FRAME_RATE;
        barrierTargetTime.current = endFrameBarrier / FRAME_RATE;
        console.log(`▶️ SCENE: Configurando 'mov_valla': ${barrierStartTime.current.toFixed(2)}s a ${barrierTargetTime.current.toFixed(2)}s.`);
        barrierAction.reset().setLoop(LoopOnce, 1).time = barrierStartTime.current;
        barrierAction.clampWhenFinished = true;
        barrierAction.paused = false;
        barrierAction.play();
        barrierAnimPlaying.current = true;
      } else { console.warn("❌ SCENE: 'mov_valla' no encontrada."); }
    }
  }));

  useFrame(() => {
    currentPos.current.lerp(targetPos.current, 0.035);
    currentQuat.current.slerp(targetQuat.current, 0.035);
    mainCam.position.copy(currentPos.current);
    mainCam.quaternion.copy(currentQuat.current);
    if (controls) {
      const dir = new Vector3(0, 0, -1).applyQuaternion(mainCam.quaternion);
      controls.target.copy(mainCam.position).add(dir);
      controls.update();
    }

    // Pausa de animación de INGRESO del camión en frame 100
    const arrivalAnimAction = actions["mov_camion"];
    if (arrivalAnimAction && arrivalAnimAction.isRunning() && !arrivalAnimAction.paused &&
      !arrivalAnimationPausedAtTarget.current && !truckExitAnimPlaying.current) {
      const TARGET_FRAME_ARRIVAL = 100;
      const targetTimeArrival = TARGET_FRAME_ARRIVAL / FRAME_RATE;
      if (arrivalAnimAction.time >= targetTimeArrival) {
        arrivalAnimAction.time = targetTimeArrival;
        arrivalAnimAction.paused = true;
        arrivalAnimationPausedAtTarget.current = true;
        console.log(`🚦 'mov_camion' (ingreso) pausada en frame ${TARGET_FRAME_ARRIVAL}.`);
      }
    }

    // Pausa de animación de SALIDA del camión en frame 250
    const exitTruckAction = actions["mov_camion"];
    if (exitTruckAction && truckExitAnimPlaying.current && exitTruckAction.isRunning() && !exitTruckAction.paused) {
      if (exitTruckAction.time >= truckExitTargetTime.current) {
        console.log(`🏁 'mov_camion' (salida) pausada en ${truckExitTargetTime.current.toFixed(2)}s (frame ~250).`);
        exitTruckAction.time = truckExitTargetTime.current;
        exitTruckAction.paused = true;
        truckExitAnimPlaying.current = false;
      }
    }

    // Pausa de la animación de la VALLA en frame 190
    const barrierAction = actions["mov_valla"];
    if (barrierAction && barrierAnimPlaying.current && barrierAction.isRunning() && !barrierAction.paused) {
      if (barrierAction.time >= barrierTargetTime.current) {
        console.log(`🏁 'mov_valla' pausada en ${barrierTargetTime.current.toFixed(2)}s (frame ~190).`);
        barrierAction.time = barrierTargetTime.current;
        barrierAction.paused = true;
        barrierAnimPlaying.current = false;
      }
    }
  });

  return <primitive object={scene} />; // scene de TEST.glb contiene camión y valla
});

export default Scene;