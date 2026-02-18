import { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Vector3, LoopOnce } from "three";

function EscenaCamion({
    modeloVisualPath,
    modeloAnimacionPath,
    nombreAnimacionActiva,
    activeCameraName,
    escalaGeneral = 1,
}) {
    const { scene, nodes, cameras } = useGLTF(modeloVisualPath);
    const { animations } = useGLTF(modeloAnimacionPath);
    const { actions } = useAnimations(animations, scene);
    const { camera: mainCam, controls } = useThree();

    useEffect(() => {
        if (activeCameraName && cameras?.length > 0) {
            const camara = cameras.find((c) => c.name === activeCameraName);
            if (camara) {
                mainCam.position.copy(camara.position);
                mainCam.quaternion.copy(camara.quaternion);
                mainCam.updateProjectionMatrix();
                if (controls) {
                    const lookAt = new Vector3(0, 0, -1).applyQuaternion(mainCam.quaternion).add(mainCam.position);
                    controls.target.copy(lookAt);
                    controls.update();
                }
            }
        }
    }, [activeCameraName, cameras, mainCam, controls]);

    useEffect(() => {
        if (nombreAnimacionActiva && actions?.[nombreAnimacionActiva]) {
            const action = actions[nombreAnimacionActiva];
            action.reset().setLoop(LoopOnce, 1).play();
            action.clampWhenFinished = true;
        }
    }, [nombreAnimacionActiva, actions]);

    useEffect(() => {
        scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [scene]);

    return <primitive object={scene} scale={escalaGeneral} />;
}

export default EscenaCamion;