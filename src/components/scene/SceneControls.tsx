"use client";

import { OrbitControls } from "@react-three/drei";
import { useAppState } from "@/components/state/app-state";

export function SceneControls() {
  const { mode, selectedObject } = useAppState();
  const isTelescope = mode === "telescope";
  const autoRotate = mode === "roam" && !selectedObject;
  const minDistance = selectedObject
    ? Math.max(2.5, selectedObject.radius * 2.2)
    : 2.5;
  const maxDistance = selectedObject
    ? Math.max(selectedObject.radius * 36, 320)
    : 360;

  return (
    <OrbitControls
      makeDefault
      enablePan={!isTelescope}
      enableZoom={!isTelescope}
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={0.35}
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  );
}
