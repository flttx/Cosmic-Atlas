"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useAppState } from "@/components/state/app-state";
import { sceneTargetMap } from "@/data/scene-targets";
import { TOUR_SEQUENCES } from "@/data/preset-scenes";

const DEFAULT_INTERVAL = 6.5;

export function TourController() {
  const { tourActive, tourSequenceId, setSelectedObject } = useAppState();
  const lastSwitch = useRef(0);
  const indexRef = useRef(0);
  const sequence = useMemo(
    () => (tourSequenceId ? TOUR_SEQUENCES[tourSequenceId] ?? null : null),
    [tourSequenceId],
  );

  useEffect(() => {
    lastSwitch.current = 0;
    indexRef.current = 0;
  }, [tourActive, tourSequenceId]);

  useFrame((state) => {
    if (!tourActive || !sequence || sequence.length === 0) {
      return;
    }
    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastSwitch.current < DEFAULT_INTERVAL) {
      return;
    }
    lastSwitch.current = elapsed;
    indexRef.current = (indexRef.current + 1) % sequence.length;
    const nextId = sequence[indexRef.current];
    setSelectedObject(sceneTargetMap[nextId] ?? null);
  });

  return null;
}
