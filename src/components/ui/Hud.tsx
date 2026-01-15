"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAppState,
  type ExploreMode,
  type QualityLevel,
} from "@/components/state/app-state";
import { orbitRadius, sceneTargets } from "@/data/scene-targets";
import type { SceneTargetType } from "@/data/scene-targets";
import { PRESET_SCENES } from "@/data/preset-scenes";
import {
  distanceToSceneUnits,
  formatDec,
  formatDistance,
  formatRa,
  raDecToCartesian,
} from "@/lib/astronomy";
import {
  buildSceneSnapshot,
  encodeSceneSnapshot,
  parseSceneSnapshot,
  type SceneSnapshot,
} from "@/lib/scene-snapshot";
import { audioManager } from "@/lib/audio";
import AIAssistant from "./AIAssistant";

const MODES: { id: ExploreMode; name: string; description: string }[] = [
  { id: "telescope", name: "望远镜模式", description: "陀螺仪指向识别天体" },
  { id: "navigator", name: "领航员模式", description: "第一人称飞行与航点" },
  { id: "orbit", name: "轨道模式", description: "锁定天体公转/自转" },
  { id: "database", name: "数据库模式", description: "完整天体目录" },
  { id: "search", name: "搜索模式", description: "HIP / NGC 快速定位" },
  { id: "roam", name: "漫游模式", description: "自由穿梭深空" },
];

const QUALITY_NEXT: Record<QualityLevel, QualityLevel> = {
  auto: "high",
  high: "medium",
  medium: "low",
  low: "auto",
};

const QUALITY_SCALE: Record<QualityLevel, number> = {
  auto: 0.85,
  high: 1,
  medium: 0.85,
  low: 0.7,
};

const QUALITY_LABEL: Record<QualityLevel, string> = {
  auto: "自动",
  high: "高",
  medium: "中",
  low: "低",
};

const SCENE_STORAGE_KEY = "cosmic-atlas-scenes";

type StoredScene = {
  id: string;
  name: string;
  snapshot: SceneSnapshot;
};

type CoordinateQuery = {
  raDeg: number;
  decDeg: number;
  distanceLy: number;
  label: string;
};

const extractField = (text: string, key: string) => {
  const regex = new RegExp(`${key}\\s*[:=]?\\s*`, "i");
  const match = regex.exec(text);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const nextIndex = rest.search(/\b(ra|dec|dist|distance)\b\s*[:=]?/i);
  const value = nextIndex === -1 ? rest : rest.slice(0, nextIndex);
  return value.trim();
};

const parseParts = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/deg/g, " ")
    .replace(/[hms°'"]/g, " ")
    .replace(/:/g, " ")
    .replace(/,/g, " ");
  const parts = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((item) => Number(item));
  if (parts.length === 0 || parts.some((item) => Number.isNaN(item))) return null;
  return parts.slice(0, 3);
};

const parseRa = (value: string) => {
  const parts = parseParts(value);
  if (!parts) return null;
  const hasHourUnit = /h/.test(value);
  const hasDegUnit = /deg|°|d/.test(value);
  const isHour = hasHourUnit || (!hasDegUnit && parts.length > 1);
  const hours = Math.abs(parts[0]) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  const signed = parts[0] < 0 ? -hours : hours;
  const raDeg = isHour ? signed * 15 : signed;
  return ((raDeg % 360) + 360) % 360;
};

const parseDec = (value: string) => {
  const parts = parseParts(value);
  if (!parts) return null;
  const degrees = Math.abs(parts[0]) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  const signed = parts[0] < 0 ? -degrees : degrees;
  return Math.max(-90, Math.min(90, signed));
};

const parseCoordinateQuery = (input: string): CoordinateQuery | null => {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  const raValue = extractField(text, "ra");
  const decValue = extractField(text, "dec");
  if (!raValue || !decValue) return null;
  const raDeg = parseRa(raValue);
  const decDeg = parseDec(decValue);
  if (raDeg === null || decDeg === null) return null;
  const distValue = extractField(text, "dist") ?? extractField(text, "distance");
  const distanceLy = distValue ? Math.max(1, Number(distValue)) : 500;
  if (Number.isNaN(distanceLy)) return null;
  return { raDeg, decDeg, distanceLy, label: `RA ${raDeg.toFixed(2)}° · DEC ${decDeg.toFixed(2)}° · ${distanceLy} ly` };
};

export default function Hud() {
  const {
    mode, setMode, settings, updateSettings, selectedObject, setSelectedObject,
    introActive, customTargets, addCustomTarget, removeCustomTarget,
    requestCameraReset, requestCameraOverview, requestCameraSnapshot,
    tourActive, tourSequenceId, startTour, stopTour, telemetry,
  } = useAppState();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("自定义天体");
  const [customType, setCustomType] = useState<SceneTargetType>("planet");
  const [customRadius, setCustomRadius] = useState(0.6);
  const [customOrbitCenter, setCustomOrbitCenter] = useState<"sun" | "earth">("sun");
  const [customOrbitRadius, setCustomOrbitRadius] = useState(1);
  const [customOrbitPeriod, setCustomOrbitPeriod] = useState(365);
  const [customInclination, setCustomInclination] = useState(0);
  const [customEccentricity, setCustomEccentricity] = useState(0);
  const [customSpinSpeed, setCustomSpinSpeed] = useState(0.3);
  const [customScale, setCustomScale] = useState(1);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [storedScenes, setStoredScenes] = useState<StoredScene[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(SCENE_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredScene[];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const customFileRef = useRef<HTMLInputElement>(null);

  const coordinateQuery = useMemo(() => parseCoordinateQuery(query), [query]);
  const allTargets = useMemo(() => [...sceneTargets, ...customTargets], [customTargets]);

  const filteredObjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allTargets;
    return allTargets.filter((object) => {
      const keywords = object.searchKeywords?.join(" ") ?? "";
      const haystack = `${object.name} ${object.catalog?.catalogId ?? ""} ${keywords}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [allTargets, query]);

  const sortTimeline = (timeline: { year: string; title: string }[]) => {
    const parseYear = (year: string) => {
      if (!year) return Number.POSITIVE_INFINITY;
      const t = year.trim();
      if (t.startsWith("前")) {
        const n = Number(t.slice(1));
        return Number.isNaN(n) ? Number.POSITIVE_INFINITY : -n;
      }
      const n = Number(t.replace(/[^\d.-]/g, ""));
      return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
    };
    return [...timeline].sort((a, b) => parseYear(a.year) - parseYear(b.year));
  };

  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  const cycleQuality = () => {
    const next = QUALITY_NEXT[settings.quality];
    updateSettings({ quality: next, resolutionScale: QUALITY_SCALE[next] });
  };
  const toggleOrbits = () => updateSettings({ showOrbits: !settings.showOrbits });
  const toggleMilkyWay = () => updateSettings({ showMilkyWay: !settings.showMilkyWay });
  const updateStarfield = (v: number) => updateSettings({ starfieldIntensity: Math.min(1.4, Math.max(0.4, v)) });
  const updateOrbitSpeed = (v: number) => updateSettings({ orbitSpeed: Math.min(2, Math.max(0.2, v)) });

  const persistScenes = (next: StoredScene[]) => {
    setStoredScenes(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const applySnapshot = (snapshot: SceneSnapshot) => {
    updateSettings(snapshot.settings ?? {});
    if (snapshot.selectedId) {
      const target = allTargets.find((item) => item.id === snapshot.selectedId);
      setSelectedObject(target ?? null);
    } else if (snapshot.camera) {
      setSelectedObject(null);
      requestCameraSnapshot(snapshot.camera);
    }
  };

  useEffect(() => {
    if (!selectedObject) {
      const resetTimer = window.setTimeout(() => setIsScanning(false), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const startTimer = window.setTimeout(() => setIsScanning(true), 0);
    const stopTimer = window.setTimeout(() => setIsScanning(false), 800);

    if (settings.voice) {
      const msg = new SpeechSynthesisUtterance(`${selectedObject.name}. ${selectedObject.type}`);
      msg.rate = 0.9;
      msg.pitch = 0.8;
      window.speechSynthesis.speak(msg);
    }

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(stopTimer);
    };
  }, [selectedObject, settings.voice]);

  const handleExportScene = () => {
    if (typeof window === "undefined") return;
    const snapshot = buildSceneSnapshot({ settings, selectedObject, telemetry });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cosmic-atlas-scene-${Date.now()}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCopyShareLink = async () => {
    if (typeof window === "undefined") return;
    const snapshot = buildSceneSnapshot({ settings, selectedObject, telemetry });
    const encoded = encodeSceneSnapshot(snapshot);
    if (!encoded) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("scene");
    url.hash = `scene=${encoded}`;
    const link = url.toString();
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
    else window.prompt("复制链接", link);
  };

  const handleImportScene = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseSceneSnapshot(JSON.parse(await file.text()));
      if (parsed) applySnapshot(parsed);
    } catch { }
    e.target.value = "";
  };

  const handleSaveLocal = () => {
    if (typeof window === "undefined") return;
    const name = window.prompt("场景名称", `场景 ${new Date().toLocaleString()}`);
    if (!name) return;
    const snapshot = buildSceneSnapshot({ settings, selectedObject, telemetry });
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    persistScenes([{ id, name: name.trim(), snapshot }, ...storedScenes].slice(0, 20));
  };

  const handleLoadLocal = (item: StoredScene) => applySnapshot(item.snapshot);
  const handleDeleteLocal = (id: string) => persistScenes(storedScenes.filter((m) => m.id !== id));

  const handleCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setCustomError("仅支持 .glb");
      e.target.value = "";
      return;
    }
    setCustomFile(file);
    setCustomError(null);
  };

  const handleCreateCustomTarget = async () => {
    if (!customFile) { setCustomError("请选择模型"); return; }
    const orbitSpec = {
      centerId: customOrbitCenter,
      radius: orbitRadius(Math.max(0.05, customOrbitRadius)),
      periodDays: Math.max(1, customOrbitPeriod),
      inclinationDeg: customInclination,
      eccentricity: Math.min(0.9, Math.max(0, customEccentricity)),
    };
    try {
      await addCustomTarget({
        name: customName.trim() || "Custom Body",
        type: customType,
        radius: Math.max(0.1, customRadius),
        description: "User defined object.",
        orbit: orbitSpec,
        position: [orbitSpec.radius, 0, 0],
        modelScale: Math.max(0.05, customScale),
        spinSpeed: Math.max(0, customSpinSpeed),
      }, customFile);
      setCustomFile(null);
      if (customFileRef.current) customFileRef.current.value = "";
    } catch { setCustomError("创建失败"); }
  };

  const handleRemoveCustomTarget = (id: string) => void removeCustomTarget(id);

  const handleCoordinateFocus = (coord: CoordinateQuery) => {
    const radius = distanceToSceneUnits(coord.distanceLy);
    const target = raDecToCartesian(coord.raDeg, coord.decDeg, radius);
    const len = Math.hypot(target[0], target[1], target[2]);
    const dir = len > 0.0001 ? [target[0] / len, target[1] / len, target[2] / len] : [0, 0, 1];
    const camera: [number, number, number] = [target[0] + dir[0] * 8, target[1] + dir[1] * 8, target[2] + dir[2] * 8];
    setSelectedObject(null);
    requestCameraSnapshot({ position: camera, target });
  };

  const handleApplyPreset = (p: (typeof PRESET_SCENES)[number]) => {
    applySnapshot(p.snapshot);
    if (p.tourSequenceId) startTour(p.tourSequenceId);
    else if (tourActive) stopTour();
  };

  if (introActive) return null;

  return (
    <div className="pointer-events-none absolute inset-0 text-foreground overflow-hidden">
      <div className="absolute inset-0 bg-atlas-void/30 mix-blend-screen atlas-scanlines pointer-events-none" />

      {/* Header */}
      <div className="pointer-events-auto absolute left-6 top-6 flex items-center gap-6">
        <div className="flex flex-col border-l-2 border-atlas-glow pl-4 py-1">
          <span className="text-sm font-bold uppercase tracking-[0.4em] text-white neon-text">Cosmic Atlas</span>
          <span className="text-[10px] text-atlas-glow/60 uppercase tracking-widest mt-0.5">Space Terminal</span>
        </div>
      </div>

      <div className="pointer-events-auto absolute left-1/2 top-6 hidden -translate-x-1/2 items-center gap-8 glass-panel px-8 py-2.5 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] text-white/70 md:flex animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-atlas-glow animate-pulse" />
          <span>{activeMode.name} MODE</span>
        </div>
        <div className="w-[1px] h-3 bg-white/10" />
        <div className="flex gap-4">
          <span>X: {telemetry.camera.x.toFixed(1)}</span>
          <span>Y: {telemetry.camera.y.toFixed(1)}</span>
          <span>Z: {telemetry.camera.z.toFixed(1)}</span>
        </div>
        <div className="w-[1px] h-3 bg-white/10" />
        <span className={telemetry.fps < 30 ? "text-red-400" : "text-atlas-glow"}>{telemetry.fps} FPS</span>
        {tourActive && tourSequenceId ? (
          <>
            <div className="w-[1px] h-3 bg-white/10" />
            <span className="text-atlas-cyan/80">TOUR {tourSequenceId}</span>
          </>
        ) : null}
      </div>

      <div className="pointer-events-auto absolute right-6 top-6 flex items-center gap-2">
        <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
          <button
            onClick={cycleQuality}
            className="rounded-full px-4 py-1.5 text-[10px] font-medium text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/40"
          >
            {QUALITY_LABEL[settings.quality]}画质
          </button>
          <button
            onClick={() => { setSelectedObject(null); requestCameraReset(); }}
            className="rounded-full px-4 py-1.5 text-[10px] font-medium text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/40"
          >
            重置视角
          </button>
          <button
            onClick={() => { setSelectedObject(null); requestCameraOverview(); }}
            className="rounded-full px-4 py-1.5 text-[10px] font-medium text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/40"
          >
            全景
          </button>
        </div>
        <button
          onClick={() => { audioManager.playClick(); setMenuOpen(true); }}
          onMouseEnter={() => audioManager.playHover()}
          className="w-10 h-10 flex items-center justify-center rounded-full glass-panel active:scale-95 interactive-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/40"
        >
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><path d="M0 1H18M0 6H18M0 11H18" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>

      {/* Panels */}
      <aside className="pointer-events-auto absolute left-6 top-24 hidden h-[calc(100%-8rem)] w-72 flex-col gap-6 glass-panel rounded-3xl p-5 lg:flex animate-fade-in">
        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-atlas-glow font-bold">Explorer</div>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog..."
            className="w-full rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white placeholder:text-white/20 outline-none transition focus-visible:border-atlas-glow/30 focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
          />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
          {coordinateQuery && (
            <button
              onClick={() => handleCoordinateFocus(coordinateQuery)}
              className="w-full rounded-xl border border-atlas-glow/30 bg-atlas-glow/5 px-4 py-3 text-left transition hover:bg-atlas-glow/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
            >
              <div className="text-xs font-bold text-white">Coordinate Lock</div>
              <div className="text-[10px] text-atlas-glow/70">{coordinateQuery.label}</div>
            </button>
          )}
          {filteredObjects.map((o) => (
            <button
              key={o.id} onClick={() => setSelectedObject(o)}
              className={`flex w-full flex-col px-4 py-3 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${selectedObject?.id === o.id ? "bg-atlas-glow/10 border-l-2 border-atlas-glow" : "hover:bg-white/5"}`}
            >
              <span className="text-xs font-bold text-white">{o.name}</span>
              <span className="text-[9px] text-white/30 uppercase">{o.catalog?.catalogId ?? o.type}</span>
            </button>
          ))}
        </div>
      </aside>

      <aside className="pointer-events-auto absolute right-6 top-24 hidden h-[calc(100%-8rem)] w-80 flex-col glass-panel rounded-3xl p-6 lg:flex animate-fade-in">
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
          {selectedObject ? (
            <div className={`space-y-6 transition-all duration-500 ${isScanning ? "opacity-30 blur-sm translate-y-2" : "opacity-100 translate-y-0"}`}>
              {isScanning && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-atlas-void/20 backdrop-blur-[2px]">
                  <div className="text-[10px] uppercase tracking-[0.4em] text-atlas-glow font-bold mb-2 animate-pulse">Scanning Target...</div>
                  <div className="w-32 h-0.5 bg-white/5 overflow-hidden">
                    <div className="w-full h-full bg-atlas-glow animate-intro-line-reveal" />
                  </div>
                </div>
              )}
              <header className="space-y-1">
                <h2 className="text-2xl font-bold text-white">{selectedObject.name}</h2>
                <div className="text-[10px] font-mono text-atlas-glow/60 lowercase">{selectedObject.type} {selectedObject.catalog?.catalogId && `· ${selectedObject.catalog.catalogId}`}</div>
              </header>
              {selectedObject.catalog && (
                <div className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
                  {[
                    { l: "Distance", v: formatDistance(selectedObject.catalog.distanceLy) },
                    { l: "Mag", v: selectedObject.catalog.magnitude.toFixed(2) },
                    { l: "R.A.", v: formatRa(selectedObject.catalog.ra) },
                    { l: "DEC.", v: formatDec(selectedObject.catalog.dec) },
                  ].map(i => (
                    <div key={i.l} className="bg-black/40 p-3 flex flex-col">
                      <span className="text-[9px] uppercase text-white/30">{i.l}</span>
                      <span className="text-xs font-mono text-white/80">{i.v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="glass-card rounded-2xl p-4 italic text-xs text-white/65 leading-relaxed">{`“${selectedObject.description}”`}</div>
              {selectedObject.timeline && (
                <div className="space-y-4">
                  <div className="text-[10px] uppercase text-white/40 font-bold border-b border-white/5 pb-2">Mission Log</div>
                  <div className="space-y-4 pl-4 border-l border-atlas-glow/20">
                    {sortTimeline(selectedObject.timeline).map(i => (
                      <div key={i.title} className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-atlas-void border border-atlas-glow" />
                        <div className="text-[10px] font-bold text-atlas-glow">{i.year}</div>
                        <div className="text-xs text-white/70">{i.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mb-4"><div className="w-4 h-4 rounded-full border border-atlas-glow/25 animate-pulse" /></div>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Awaiting Command</div>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-6 pt-6 border-t border-white/5">
          <div className="space-y-3">
            <div className="text-[10px] uppercase text-white/40 font-bold">Presets</div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SCENES.slice(0, 2).map(p => (
                <button key={p.id} onClick={() => handleApplyPreset(p)} className="p-2 rounded-xl border border-white/5 bg-white/5 text-left transition hover:border-atlas-glow/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25">
                  <div className="text-[10px] font-bold text-white truncate">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={toggleOrbits} className={`rounded-xl py-2 text-[9px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${settings.showOrbits ? "bg-atlas-glow/10 border-atlas-glow/40 text-atlas-glow" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"}`}>Orbits</button>
              <button onClick={toggleMilkyWay} className={`rounded-xl py-2 text-[9px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${settings.showMilkyWay ? "bg-atlas-glow/10 border-atlas-glow/40 text-atlas-glow" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"}`}>Galactic</button>
            </div>
            <div className="space-y-2">
              <input type="range" min={0.4} max={1.4} step={0.05} value={settings.starfieldIntensity} onChange={e => updateStarfield(Number(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full" />
              <input type="range" min={0.2} max={2} step={0.05} value={settings.orbitSpeed} onChange={e => updateOrbitSpeed(Number(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full" />
            </div>
          </div>
        </div>
      </aside>

      <Dialog open={menuOpen} onClose={setMenuOpen} className="relative z-50">
        <div className="fixed inset-0 bg-atlas-void/90 backdrop-blur-md" />
        <div className="fixed inset-0 flex items-center justify-center p-6">
          <Dialog.Panel className="w-full max-w-3xl glass-panel rounded-3xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.35em] text-atlas-glow/70 font-bold">
                  Command Deck
                </div>
                <Dialog.Title className="text-xl font-bold text-white">
                  系统面板
                </Dialog.Title>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/30"
                aria-label="关闭"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto scrollbar-hide p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="space-y-3">
                  <div className="text-[10px] uppercase text-white/40 font-bold">Modes</div>
                  <div className="grid gap-3">
                    {MODES.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMode(m.id); setMenuOpen(false); }}
                        className={`p-4 rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${m.id === mode ? "bg-atlas-glow/10 border-atlas-glow/40" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
                      >
                        <div className={`text-sm font-bold ${m.id === mode ? "text-atlas-glow" : "text-white"}`}>{m.name}</div>
                        <div className="text-[10px] text-white/40">{m.description}</div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 space-y-3">
                    <div className="text-[10px] uppercase text-white/40 font-bold">System</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateSettings({ sound: !settings.sound })}
                        className={`rounded-xl py-2 text-[9px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${settings.sound ? "bg-atlas-glow/10 border-atlas-glow/40 text-atlas-glow" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"}`}
                      >
                        Sound
                      </button>
                      <button
                        onClick={() => updateSettings({ voice: !settings.voice })}
                        className={`rounded-xl py-2 text-[9px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${settings.voice ? "bg-atlas-glow/10 border-atlas-glow/40 text-atlas-glow" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"}`}
                      >
                        Voice
                      </button>
                      <button
                        onClick={() => updateSettings({ haptics: !settings.haptics })}
                        className={`rounded-xl py-2 text-[9px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${settings.haptics ? "bg-atlas-glow/10 border-atlas-glow/40 text-atlas-glow" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"}`}
                      >
                        Haptics
                      </button>
                      <button
                        onClick={() => updateSettings({ showStats: !settings.showStats })}
                        className={`rounded-xl py-2 text-[9px] font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 ${settings.showStats ? "bg-atlas-glow/10 border-atlas-glow/40 text-atlas-glow" : "bg-white/5 border-white/5 text-white/20 hover:bg-white/10"}`}
                      >
                        Stats
                      </button>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="text-[10px] uppercase text-white/40 font-bold">Scene</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopyShareLink}
                      className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                    >
                      Share Link
                    </button>
                    <button
                      onClick={handleExportScene}
                      className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                    >
                      Import
                    </button>
                    <button
                      onClick={handleSaveLocal}
                      className="rounded-xl border border-atlas-glow/30 bg-atlas-glow/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-atlas-glow transition hover:bg-atlas-glow/15 hover:border-atlas-glow/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                    >
                      Save
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase text-white/40 font-bold">Saved</div>
                      <div className="text-[10px] font-mono text-white/30">{storedScenes.length}/20</div>
                    </div>
                    {storedScenes.length === 0 ? (
                      <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-xs text-white/40">
                        暂无本地场景。点击 <span className="text-atlas-glow">Save</span> 保存当前视角。
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {storedScenes.slice(0, 6).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 rounded-2xl border border-white/5 bg-black/30 px-3 py-2">
                            <button
                              onClick={() => { handleLoadLocal(item); setMenuOpen(false); }}
                              className="flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 rounded-xl px-2 py-2"
                            >
                              <div className="text-[10px] font-bold text-white truncate">{item.name}</div>
                            </button>
                            <button
                              onClick={() => handleDeleteLocal(item.id)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/50 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="lg:col-span-2">
                  <details className="rounded-3xl border border-white/5 bg-black/20 open:bg-black/25">
                    <summary className="cursor-pointer select-none px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-atlas-glow/70 font-bold">
                            Custom Targets
                          </div>
                          <div className="text-sm font-bold text-white">
                            自定义天体（本地）
                          </div>
                        </div>
                        <div className="h-8 w-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/60">
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </summary>

                    <div className="px-6 pb-6 space-y-6">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="text-[10px] uppercase text-white/40 font-bold">Basic</div>
                            <input
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="名称"
                              className="w-full rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white placeholder:text-white/20 outline-none transition focus-visible:border-atlas-glow/30 focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={customType}
                                onChange={(e) => setCustomType(e.target.value as SceneTargetType)}
                                className="w-full rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white outline-none transition focus-visible:border-atlas-glow/30 focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                              >
                                <option value="planet">Planet</option>
                                <option value="moon">Moon</option>
                                <option value="comet">Comet</option>
                                <option value="satellite">Satellite</option>
                                <option value="star">Star</option>
                                <option value="galaxy">Galaxy</option>
                                <option value="nebula">Nebula</option>
                                <option value="blackhole">Blackhole</option>
                              </select>
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>R</span>
                                <span>{customRadius.toFixed(2)}</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={0.1}
                              max={4}
                              step={0.05}
                              value={customRadius}
                              onChange={(e) => setCustomRadius(Number(e.target.value))}
                              className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Orbit</div>
                              <select
                                value={customOrbitCenter}
                                onChange={(e) => setCustomOrbitCenter(e.target.value as "sun" | "earth")}
                                className="rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 outline-none transition focus-visible:border-atlas-glow/30 focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                              >
                                <option value="sun">Sun</option>
                                <option value="earth">Earth</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>AU</span>
                                <span>{customOrbitRadius.toFixed(2)}</span>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>d</span>
                                <span>{customOrbitPeriod.toFixed(0)}</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={0.2}
                              max={40}
                              step={0.1}
                              value={customOrbitRadius}
                              onChange={(e) => setCustomOrbitRadius(Number(e.target.value))}
                              className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                            />
                            <input
                              type="range"
                              min={10}
                              max={5000}
                              step={10}
                              value={customOrbitPeriod}
                              onChange={(e) => setCustomOrbitPeriod(Number(e.target.value))}
                              className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Inclination</div>
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>°</span>
                                <span>{customInclination.toFixed(0)}</span>
                              </div>
                              <input
                                type="range"
                                min={-60}
                                max={60}
                                step={1}
                                value={customInclination}
                                onChange={(e) => setCustomInclination(Number(e.target.value))}
                                className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Eccentricity</div>
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>e</span>
                                <span>{customEccentricity.toFixed(2)}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={0.9}
                                step={0.01}
                                value={customEccentricity}
                                onChange={(e) => setCustomEccentricity(Number(e.target.value))}
                                className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Model</div>
                              <button
                                onClick={() => customFileRef.current?.click()}
                                className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                              >
                                Select .glb
                              </button>
                            </div>

                            <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                              {customFile ? (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-bold text-white truncate">{customFile.name}</div>
                                  <div className="text-[10px] font-mono text-white/30">{(customFile.size / 1024 / 1024).toFixed(2)} MB</div>
                                </div>
                              ) : (
                                <div className="text-xs text-white/40">
                                  选择一个 <span className="text-atlas-glow">.glb</span> 文件（≤50MB）。
                                </div>
                              )}
                            </div>

                            {customError ? (
                              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                                {customError}
                              </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={handleCreateCustomTarget}
                                disabled={!customFile}
                                className="rounded-xl border border-atlas-glow/30 bg-atlas-glow/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-atlas-glow transition hover:bg-atlas-glow/15 hover:border-atlas-glow/45 disabled:opacity-40 disabled:hover:bg-atlas-glow/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                              >
                                Create
                              </button>
                              <button
                                onClick={() => { setCustomFile(null); if (customFileRef.current) customFileRef.current.value = ""; }}
                                className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60 transition hover:bg-white/10 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Spin</div>
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>ω</span>
                                <span>{customSpinSpeed.toFixed(2)}</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={3}
                                step={0.05}
                                value={customSpinSpeed}
                                onChange={(e) => setCustomSpinSpeed(Number(e.target.value))}
                                className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Scale</div>
                              <div className="rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white/70 font-mono flex items-center justify-between">
                                <span>x</span>
                                <span>{customScale.toFixed(2)}</span>
                              </div>
                              <input
                                type="range"
                                min={0.05}
                                max={10}
                                step={0.05}
                                value={customScale}
                                onChange={(e) => setCustomScale(Number(e.target.value))}
                                className="w-full h-1 bg-white/5 appearance-none accent-atlas-glow rounded-full"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase text-white/40 font-bold">Local</div>
                              <div className="text-[10px] font-mono text-white/30">{customTargets.length}</div>
                            </div>
                            {customTargets.length === 0 ? (
                              <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-xs text-white/40">
                                暂无自定义天体。
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {customTargets.slice(0, 6).map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 rounded-2xl border border-white/5 bg-black/30 px-3 py-2">
                                    <button
                                      onClick={() => { setSelectedObject(t); setMenuOpen(false); }}
                                      className="flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25 rounded-xl px-2 py-2"
                                    >
                                      <div className="text-[10px] font-bold text-white truncate">{t.name}</div>
                                      <div className="text-[9px] uppercase text-white/30">{t.type}</div>
                                    </button>
                                    <button
                                      onClick={() => handleRemoveCustomTarget(t.id)}
                                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/50 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/25"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </section>

                <div className="lg:col-span-2 flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/30"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl bg-white text-atlas-void px-5 py-3 text-[10px] font-bold uppercase tracking-wider transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atlas-glow/30"
                  >
                    Resume Mission
                  </button>
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportScene} />
      <input ref={customFileRef} type="file" accept=".glb" className="hidden" onChange={handleCustomFile} />

      {/* Bottom Left: AI Assistant */}
      <div className="pointer-events-auto absolute bottom-6 left-6 hidden w-80 lg:block animate-fade-in shadow-2xl">
        <AIAssistant />
      </div>

      {/* Mobile Target Info */}
      {selectedObject && (
        <div className="pointer-events-auto absolute bottom-24 left-6 right-6 lg:hidden animate-fade-in">
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-atlas-glow/20">
            <div className="flex flex-col">
              <span className="text-[10px] text-atlas-glow font-bold uppercase tracking-widest">{selectedObject.type}</span>
              <span className="text-sm font-bold text-white">{selectedObject.name}</span>
            </div>
            <button
              onClick={() => setSelectedObject(null)}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="2" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
