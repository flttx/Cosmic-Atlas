"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Stats } from "@react-three/drei";
import * as THREE from "three";
import { useAppState } from "@/components/state/app-state";
import { SceneControls } from "@/components/scene/SceneControls";
import { FocusController } from "@/components/scene/FocusController";
import { SceneRoot } from "@/components/scene/SceneRoot";
import { Telemetry } from "@/components/scene/Telemetry";
import { TourController } from "@/components/scene/TourController";
import { useResolutionScale } from "@/components/scene/useResolutionScale";

export default function SpaceCanvas() {
  const {
    settings,
    selectedObject,
    setSelectedObject,
    requestCameraReset,
  } = useAppState();
  const dpr = useResolutionScale(settings.quality, settings.resolutionScale);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 2, 12], fov: 50, near: 0.1, far: 800 }}
        gl={{
          antialias: settings.quality !== "low",
          powerPreference: "high-performance",
          alpha: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        onPointerMissed={(event) => {
          if (event.button === 0 && selectedObject) {
            setSelectedObject(null);
            requestCameraReset();
          }
        }}
      >
        <Suspense fallback={null}>
          <SceneRoot />
        </Suspense>
        <SceneControls />
        <FocusController />
        <TourController />
        <Telemetry />
        {settings.showStats ? <Stats showPanel={0} /> : null}
      </Canvas>
    </div>
  );
}
