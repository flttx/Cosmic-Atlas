"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { useAppState } from "@/components/state/app-state";

export function Telemetry() {
  const { setTelemetry } = useAppState();
  const { camera, controls } = useThree();
  const lastUpdate = useRef(0);
  const frames = useRef(0);

  useFrame((state) => {
    frames.current += 1;
    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastUpdate.current >= 1) {
      const fps = Math.round(frames.current / (elapsed - lastUpdate.current));
      lastUpdate.current = elapsed;
      frames.current = 0;
      const hasControls =
        controls && typeof (controls as { target?: unknown }).target !== "undefined";
      const target = hasControls
        ? (controls as { target: { x: number; y: number; z: number } }).target
        : { x: 0, y: 0, z: 0 };

      setTelemetry({
        fps,
        camera: {
          x: Number(camera.position.x.toFixed(2)),
          y: Number(camera.position.y.toFixed(2)),
          z: Number(camera.position.z.toFixed(2)),
        },
        target: {
          x: Number(target.x.toFixed(2)),
          y: Number(target.y.toFixed(2)),
          z: Number(target.z.toFixed(2)),
        },
      });
    }
  });

  return null;
}
