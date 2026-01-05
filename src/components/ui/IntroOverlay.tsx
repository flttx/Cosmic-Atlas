"use client";

import { useEffect, useMemo, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useAppState } from "@/components/state/app-state";
import { sceneTargetMap } from "@/data/scene-targets";
import { audioManager } from "@/lib/audio";

type IntroView = {
  id: string;
  name: string;
  description: string;
  selectedId?: string;
  camera?: { position: [number, number, number]; target: [number, number, number] };
};

const INTRO_VIEWS: IntroView[] = [
  {
    id: "solar-overview",
    name: "太阳系全景",
    description: "从外侧俯瞰行星群绕日运行",
    camera: { position: [0, 14, 70], target: [0, 0, 0] },
  },
  {
    id: "earth-moon",
    name: "地月系统",
    description: "贴近地球与月球的静谧轨道",
    selectedId: "earth",
  },
  {
    id: "milky-way",
    name: "银河远眺",
    description: "感受银河脊柱与深空星海",
    camera: { position: [0, 30, 150], target: [0, 0, 0] },
  },
  {
    id: "nebula-corridor",
    name: "星云走廊",
    description: "穿行星云与深空尘埃带",
    selectedId: "sagittarius-nebula",
  },
];

export default function IntroOverlay() {
  const {
    introActive,
    completeIntro,
    setSelectedObject,
    requestCameraSnapshot,
    requestCameraOverview,
  } = useAppState();
  const { progress } = useProgress();
  const [stage, setStage] = useState<"intro" | "views">("intro");
  const [isAssetsLoaded, setIsAssetsLoaded] = useState(false);
  const [visibleLines, setVisibleLines] = useState<number>(0);

  // 简化加载逻辑：进度达到100%或3秒后自动继续
  useEffect(() => {
    if (progress >= 100) {
      setIsAssetsLoaded(true);
      return;
    }

    // 3秒后强制允许继续
    const forceTimer = setTimeout(() => {
      setIsAssetsLoaded(true);
    }, 3000);

    return () => clearTimeout(forceTimer);
  }, [progress]);

  // 立即开始显示文字，不等待资源加载
  useEffect(() => {
    if (!introActive) return;

    if (stage === "intro") {
      // 立即显示第一行
      setVisibleLines(1);

      const interval = setInterval(() => {
        setVisibleLines((prev) => {
          if (prev >= 3) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 600);

      return () => clearInterval(interval);
    }
  }, [introActive, stage]);

  const introLines = useMemo(
    () => [
      "在无垠的黑与光之间，宇宙缓慢呼吸。",
      "行星循轨而行，星云在时间里翻涌。",
      "从此刻起，你将以一束微光穿行群星。",
    ],
    [],
  );

  if (!introActive) {
    return null;
  }

  const handleSelect = (view: IntroView) => {
    if (view.selectedId) {
      setSelectedObject(sceneTargetMap[view.selectedId] ?? null);
    } else if (view.camera) {
      setSelectedObject(null);
      requestCameraSnapshot(view.camera);
    }
    completeIntro();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-atlas-void text-emerald-50 backdrop-blur-md transition-all duration-1000">
      {/* Background layer */}
      <div className="absolute inset-0 star-field pointer-events-none" />

      {/* Glow elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full animate-pulse-glow" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-16 px-8 text-center">
        <header className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-center gap-6 opacity-40">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-emerald-400" />
            <span className="text-[10px] uppercase tracking-[0.8em] font-bold text-emerald-300 neon-text">
              Cosmic Atlas
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-emerald-400" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extralight tracking-[-0.02em] text-white">
            Beyond the <span className="font-medium text-emerald-400 italic">Event Horizon</span>
          </h1>
        </header>

        {!isAssetsLoaded ? (
          <div className="flex flex-col items-center space-y-4 animate-pulse cursor-pointer" onClick={() => setIsAssetsLoaded(true)}>
            <div className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 font-bold">Synchronizing Universe Data</div>
            <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-white/30">{progress.toFixed(0)}%</div>
            <div className="text-[9px] text-white/20 mt-2 hover:text-emerald-400/60 transition-colors">点击任意处跳过加载 / Click to skip</div>
          </div>
        ) : stage === "intro" ? (
          <div className="flex flex-col items-center space-y-12 max-w-2xl">
            <div className="space-y-8 min-h-[140px]">
              {introLines.map((line, idx) => (
                <p
                  key={line}
                  className={`text-xl md:text-2xl font-extralight text-emerald-100/70 leading-relaxed transition-all duration-1000 transform ${visibleLines > idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                >
                  {line}
                </p>
              ))}
            </div>

            <button
              className={`mt-12 px-12 py-4 rounded-full border border-emerald-400/20 bg-emerald-400/5 text-[10px] font-bold tracking-[0.4em] uppercase transition-all duration-500 hover:bg-emerald-400/10 hover:border-emerald-400/40 hover:scale-105 active:scale-95 group interactive-btn glitch-hover ${visibleLines >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                }`}
              onMouseEnter={() => audioManager.playHover()}
              onClick={() => { audioManager.playClick(); setStage("views"); }}
            >
              <span className="text-emerald-300 group-hover:text-emerald-100 transition-colors">
                Engage Discovery
              </span>
            </button>
          </div>
        ) : (
          <div className="w-full space-y-12 animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/30">
              Select Initial Insertion Point
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {INTRO_VIEWS.map((view) => (
                <button
                  key={view.id}
                  className="scanline-effect glass-card group flex flex-col items-start p-8 text-left rounded-3xl border border-white/5 hover:border-emerald-400/30 transition-all hover:-translate-y-1 active:scale-[0.98] interactive-btn"
                  onMouseEnter={() => audioManager.playHover()}
                  onClick={() => { audioManager.playClick(); handleSelect(view); }}
                >
                  <div className="flex w-full items-start justify-between mb-4">
                    <span className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {view.name}
                    </span>
                    <div className="h-6 w-6 rounded-full border border-white/10 flex items-center justify-center group-hover:border-emerald-400/40 transition-colors">
                      <div className="h-1 w-1 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-100/40 font-bold mb-2">Sector 0-1</p>
                  <p className="text-xs text-white/40 font-light leading-relaxed">
                    {view.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="pt-8">
              <button
                className="text-[10px] font-bold text-white/20 hover:text-emerald-400/60 tracking-[0.3em] uppercase transition-colors"
                onClick={() => {
                  requestCameraOverview();
                  completeIntro();
                }}
              >
                Skip to Tactical Overview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
