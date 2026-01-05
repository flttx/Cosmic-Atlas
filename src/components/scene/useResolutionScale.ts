import { useEffect, useState } from "react";
import type { QualityLevel } from "@/components/state/app-state";

const qualityScale: Record<Exclude<QualityLevel, "auto">, number> = {
  high: 1,
  medium: 0.85,
  low: 0.7,
};

export function useResolutionScale(quality: QualityLevel, baseScale: number) {
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const update = () => {
      const device = window.devicePixelRatio || 1;
      const isMobile = window.innerWidth < 768;
      const scale = quality === "auto" ? baseScale : qualityScale[quality];
      const maxDpr = isMobile ? 1.4 : 2.2;
      const next = Math.min(device * scale, maxDpr);
      setDpr(Number(next.toFixed(2)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [quality, baseScale]);

  return dpr;
}
