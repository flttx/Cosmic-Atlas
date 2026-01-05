"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAppState } from "@/components/state/app-state";
import { getOrbitPosition } from "@/lib/orbit-cache";

const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const DEFAULT_POSITION = new THREE.Vector3(0, 2, 12);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const OVERVIEW_POSITION = new THREE.Vector3(0, 14, 70);
const TRANSITION_DURATION = 1.1;

export function FocusController() {
  const {
    selectedObject,
    settings,
    cameraResetRequested,
    clearCameraReset,
    cameraSnapshot,
    clearCameraSnapshot,
    cameraOverviewRequested,
    clearCameraOverview,
  } = useAppState();
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const cameraRef = useRef(camera);

  useEffect(() => {
    cameraRef.current = camera as THREE.PerspectiveCamera;
  }, [camera]);

  const target = useMemo(() => new THREE.Vector3(), []);
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const focusOffset = useRef(new THREE.Vector3(0, 0, 0));
  const lastSelectedId = useRef<string | null>(null);
  const transitionStart = useRef(0);
  const transitioning = useRef(false);
  const isInteracting = useRef(false);
  const warpStrength = useRef(0);

  useEffect(() => {
    if (!controls || typeof (controls as { addEventListener?: unknown }).addEventListener !== "function") {
      return;
    }
    const start = () => {
      isInteracting.current = true;
    };
    const end = () => {
      isInteracting.current = false;
    };
    const eventSource = controls as {
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    };
    eventSource.addEventListener("start", start);
    eventSource.addEventListener("end", end);
    return () => {
      eventSource.removeEventListener("start", start);
      eventSource.removeEventListener("end", end);
    };
  }, [controls]);

  useFrame((state, delta) => {
    const lerpFactor = 1 - Math.exp(-delta * 4);
    const cam = cameraRef.current;
    const focus = selectedObject;
    const hasControls =
      controls && typeof (controls as { target?: unknown }).target !== "undefined";

    if (focus) {
      const focusPosition = focus.orbit
        ? getOrbitPosition(
            focus,
            state.clock.elapsedTime,
            settings.orbitSpeed,
          )
        : focus.position;
      target.set(...focusPosition);
      const radius = Math.max(focus.radius, 0.4);
      const distance = radius * 6 + 4;

      if (lastSelectedId.current !== focus.id) {
        lastSelectedId.current = focus.id;
        transitioning.current = true;
        transitionStart.current = state.clock.elapsedTime;
        const currentTarget = hasControls
          ? (controls as { target: THREE.Vector3 }).target
          : target;
        focusOffset.current.copy(cam.position).sub(currentTarget);
        warpStrength.current = 1;
      }

      if (transitioning.current) {
        direction.copy(focusOffset.current);
        if (direction.lengthSq() < 0.0001) {
          direction.set(0, 0.35, 1);
        }
        direction.normalize();
        desiredPosition.copy(target).addScaledVector(direction, distance);

        const speedUp = 1 + warpStrength.current * 1.2;
        cam.position.lerp(desiredPosition, lerpFactor * speedUp);
        if (hasControls) {
          (controls as { target: THREE.Vector3 }).target.lerp(
            target,
            lerpFactor * speedUp,
          );
          (controls as { update: () => void }).update();
        } else {
          cam.lookAt(target);
        }

        if (
          state.clock.elapsedTime - transitionStart.current >=
          TRANSITION_DURATION
        ) {
          transitioning.current = false;
          focusOffset.current.copy(cam.position).sub(target);
        }
        return;
      }

      if (hasControls) {
        const controlsTarget = (controls as { target: THREE.Vector3 }).target;
        if (isInteracting.current) {
          controlsTarget.copy(target);
          (controls as { update: () => void }).update();
          focusOffset.current.copy(camera.position).sub(controlsTarget);
          return;
        }

        desiredPosition.copy(target).add(focusOffset.current);
        cam.position.lerp(desiredPosition, lerpFactor);
        controlsTarget.lerp(target, lerpFactor);
        (controls as { update: () => void }).update();
      } else {
        cam.position.copy(target).add(focusOffset.current);
        cam.lookAt(target);
      }
      focusOffset.current.copy(cam.position).sub(target);
      return;
    }

    lastSelectedId.current = null;
    transitioning.current = false;

    if (cameraSnapshot) {
      target.set(...cameraSnapshot.target);
      desiredPosition.set(...cameraSnapshot.position);
      cam.position.lerp(desiredPosition, lerpFactor);
      if (hasControls) {
        (controls as { target: THREE.Vector3 }).target.lerp(
          target,
          lerpFactor,
        );
        (controls as { update: () => void }).update();
      } else {
        cam.lookAt(target);
      }

      if (cam.position.distanceTo(desiredPosition) < 0.05) {
        clearCameraSnapshot();
      }
      return;
    }

    if (cameraOverviewRequested) {
      cam.position.lerp(OVERVIEW_POSITION, lerpFactor);
      if (hasControls) {
        (controls as { target: THREE.Vector3 }).target.lerp(
          OVERVIEW_TARGET,
          lerpFactor,
        );
        (controls as { update: () => void }).update();
      } else {
        cam.lookAt(OVERVIEW_TARGET);
      }

      if (cam.position.distanceTo(OVERVIEW_POSITION) < 0.05) {
        clearCameraOverview();
      }
      return;
    }

    if (cameraResetRequested) {
      cam.position.lerp(DEFAULT_POSITION, lerpFactor);
      if (hasControls) {
        (controls as { target: THREE.Vector3 }).target.lerp(
          DEFAULT_TARGET,
          lerpFactor,
        );
        (controls as { update: () => void }).update();
      } else {
        cam.lookAt(DEFAULT_TARGET);
      }

      if (cam.position.distanceTo(DEFAULT_POSITION) < 0.05) {
        clearCameraReset();
      }
    }

    const fovTarget = warpStrength.current > 0.001 ? 58 : 50;
    const fovLerp = warpStrength.current > 0.001 ? lerpFactor * 2 : lerpFactor * 1.5;
    cam.fov = THREE.MathUtils.lerp(cam.fov, fovTarget, fovLerp);
    if (Math.abs(cam.fov - fovTarget) < 0.05) {
      cam.fov = fovTarget;
    }
    cam.updateProjectionMatrix();
    if (warpStrength.current > 0.001) {
      warpStrength.current *= Math.exp(-delta * 3.4);
    }
  });

  return null;
}
