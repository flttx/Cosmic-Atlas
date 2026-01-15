"use client";

import { useAppState } from "@/components/state/app-state";
import { useHydrated } from "@/lib/use-hydrated";
import Image from "next/image";
import { useMemo } from "react";

export default function AIAssistant() {
    const { selectedObject } = useAppState();
    const hydrated = useHydrated();

    const message = useMemo(() => {
        if (!hydrated) {
            return "System Ready. Awaiting navigation command.";
        }
        if (selectedObject) {
            const messages = [
                `Analyzing ${selectedObject.name}...`,
                `Scanning Sector: ${selectedObject.type}`,
                `Telemetry synchronized with ${selectedObject.id}`,
                "Atmospheric data incoming...",
            ];
            const hash = selectedObject.id
                .split("")
                .reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381);
            return messages[hash % messages.length];
        }
        return "Orbiting... Scanning for points of interest.";
    }, [hydrated, selectedObject]);

    return (
        <div className="flex items-center space-x-4 p-4 glass-panel rounded-2xl border-atlas-glow/10">
            {/* Hologram Circle */}
            <div className="relative w-16 h-16 rounded-full overflow-hidden hologram-container border border-atlas-glow/30 bg-atlas-ink/40">
                <Image
                    src="/assets/images/ai-avatar.png"
                    alt="AI Assistant"
                    fill
                    sizes="64px"
                    className="object-cover hologram-img opacity-80"
                    priority={false}
                />
                {/* Animated Scanline Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-atlas-glow/5 to-transparent animate-pulse" />
            </div>

            {/* Info & Text */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-atlas-glow/80">AI Navigator</span>
                    <div className="flex space-x-1">
                        <div className="w-1 h-1 rounded-full bg-atlas-glow animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-atlas-glow animate-pulse delay-75" />
                        <div className="w-1 h-1 rounded-full bg-atlas-glow animate-pulse delay-150" />
                    </div>
                </div>
                <p className="text-xs text-white/70 font-mono line-clamp-2 italic leading-relaxed">
                    {`“${message}”`}
                </p>
            </div>
        </div>
    );
}
