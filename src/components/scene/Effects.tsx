"use client";

import { useAppState } from "@/components/state/app-state";
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useHydrated } from "@/lib/use-hydrated";

export function Effects() {
    const { settings } = useAppState();
    const hydrated = useHydrated();

    if (!hydrated || settings.quality === "low") return null;

    return (
        <EffectComposer disableNormalPass>
            <Bloom
                intensity={1.2}
                luminanceThreshold={0.2}
                luminanceSmoothing={0.9}
                mipmapBlur
            />
            <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
            {settings.quality === "high" && (
                <ChromaticAberration
                    blendFunction={BlendFunction.NORMAL}
                    offset={[0.0005, 0.0005]}
                />
            )}
        </EffectComposer>
    );
}
