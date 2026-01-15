"use client";

import { useAppState } from "@/components/state/app-state";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export function SelectionMarker() {
    const { selectedObject } = useAppState();
    const groupRef = useRef<THREE.Group>(null);
    const ringRef1 = useRef<THREE.Mesh>(null);
    const ringRef2 = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!selectedObject || !groupRef.current) return;

        // Smoothly follow the target if needed, but here we'll just position it
        // If the target is an OrbitingGroup, we might need world position
        // For now, we assume simple static or the group will be nested in SceneRoot

        const time = state.clock.elapsedTime;
        if (ringRef1.current) {
            ringRef1.current.rotation.z = time * 0.5;
            ringRef1.current.rotation.x = Math.sin(time * 0.3) * 0.1;
        }
        if (ringRef2.current) {
            ringRef2.current.rotation.z = -time * 0.8;
            ringRef2.current.rotation.y = Math.cos(time * 0.4) * 0.1;
        }
    });

    if (!selectedObject) return null;

    const radius = selectedObject.radius * 1.5;

    return (
        <group ref={groupRef} position={selectedObject.position}>
            <mesh ref={ringRef1} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius * 1.1, radius * 1.15, 64]} />
                <meshBasicMaterial color="#7dd3fc" transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={ringRef2} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius * 1.2, radius * 1.22, 4, 1, 0, Math.PI * 0.2]} />
                <meshBasicMaterial color="#7dd3fc" transparent opacity={0.55} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}
