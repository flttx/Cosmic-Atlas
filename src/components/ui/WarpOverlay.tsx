"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/components/state/app-state";
import { audioManager } from "@/lib/audio";

export default function WarpOverlay() {
  const { selectedObject } = useAppState();
  const [alpha, setAlpha] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedObject) return;

    audioManager.playWarp();
    let alphaValue = 0.95;

    const tick = () => {
      setAlpha(alphaValue);
      alphaValue *= 0.92;
      if (alphaValue < 0.01) {
        setAlpha(0);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAlpha(0);
    };
  }, [selectedObject]);

  if (alpha <= 0.01) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      style={{
        opacity: alpha,
        background: `
          radial-gradient(circle at 50% 50%, rgba(125, 211, 252, 0.42) 0%, transparent 40%),
          repeating-conic-gradient(from 0deg, rgba(125, 211, 252, 0.12) 0deg 0.5deg, transparent 1deg 10deg)
        `,
        mixBlendMode: "screen",
        filter: "blur(2px) contrast(1.2)",
      }}
    />
  );
}
