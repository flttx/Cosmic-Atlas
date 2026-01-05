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
    if (selectedObject) {
      setIsScanning(true);
      const timer = setTimeout(() => setIsScanning(false), 800);

      if (settings.voice) {
        const msg = new SpeechSynthesisUtterance(`${selectedObject.name}. ${selectedObject.type}`);
        msg.rate = 0.9;
        msg.pitch = 0.8;
        window.speechSynthesis.speak(msg);
      }

      return () => clearTimeout(timer);
    }
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
          <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest mt-0.5">Space Terminal</span>
        </div>
      </div>

      <div className="pointer-events-auto absolute left-1/2 top-6 hidden -translate-x-1/2 items-center gap-8 glass-panel px-8 py-2.5 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-100/80 md:flex animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{activeMode.name} MODE</span>
        </div>
        <div className="w-[1px] h-3 bg-white/10" />
        <div className="flex gap-4">
          <span>X: {telemetry.camera.x.toFixed(1)}</span>
          <span>Y: {telemetry.camera.y.toFixed(1)}</span>
          <span>Z: {telemetry.camera.z.toFixed(1)}</span>
        </div>
        <div className="w-[1px] h-3 bg-white/10" />
        <span className={telemetry.fps < 30 ? "text-red-400" : "text-emerald-400"}>{telemetry.fps} FPS</span>
      </div>

      <div className="pointer-events-auto absolute right-6 top-6 flex items-center gap-2">
        <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
          <button onClick={cycleQuality} className="rounded-full px-4 py-1.5 text-[10px] font-medium text-emerald-50 hover:bg-white/10">
            {QUALITY_LABEL[settings.quality]}画质
          </button>
          <button onClick={() => { setSelectedObject(null); requestCameraReset(); }} className="rounded-full px-4 py-1.5 text-[10px] font-medium text-emerald-50 hover:bg-white/10">重置视角</button>
        </div>
        <button
          onClick={() => { audioManager.playClick(); setMenuOpen(true); }}
          onMouseEnter={() => audioManager.playHover()}
          className="w-10 h-10 flex items-center justify-center rounded-full glass-panel active:scale-95 interactive-btn"
        >
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><path d="M0 1H18M0 6H18M0 11H18" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>

      {/* Panels */}
      <aside className="pointer-events-auto absolute left-6 top-24 hidden h-[calc(100%-8rem)] w-72 flex-col gap-6 glass-panel rounded-3xl p-5 lg:flex animate-fade-in">
        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold">Explorer</div>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog..."
            className="w-full rounded-xl border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none"
          />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
          {coordinateQuery && (
            <button
              onClick={() => handleCoordinateFocus(coordinateQuery)}
              className="w-full rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-left hover:bg-emerald-400/10"
            >
              <div className="text-xs font-bold text-white">Coordinate Lock</div>
              <div className="text-[10px] text-emerald-300/70">{coordinateQuery.label}</div>
            </button>
          )}
          {filteredObjects.map((o) => (
            <button
              key={o.id} onClick={() => setSelectedObject(o)}
              className={`flex w-full flex-col px-4 py-3 rounded-xl transition ${selectedObject?.id === o.id ? "bg-emerald-400/10 border-l-2 border-emerald-400" : "hover:bg-white/5"}`}
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
                  <div className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 font-bold mb-2 animate-pulse">Scanning Target...</div>
                  <div className="w-32 h-0.5 bg-white/5 overflow-hidden">
                    <div className="w-full h-full bg-emerald-400 animate-intro-line-reveal" />
                  </div>
                </div>
              )}
              <header className="space-y-1">
                <h2 className="text-2xl font-bold text-white">{selectedObject.name}</h2>
                <div className="text-[10px] font-mono text-emerald-400/60 lowercase">{selectedObject.type} {selectedObject.catalog?.catalogId && `· ${selectedObject.catalog.catalogId}`}</div>
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
                      <span className="text-xs font-mono text-emerald-100">{i.v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="glass-card rounded-2xl p-4 italic text-xs text-emerald-100/70 leading-relaxed">"{selectedObject.description}"</div>
              {selectedObject.timeline && (
                <div className="space-y-4">
                  <div className="text-[10px] uppercase text-white/40 font-bold border-b border-white/5 pb-2">Mission Log</div>
                  <div className="space-y-4 pl-4 border-l border-emerald-400/20">
                    {sortTimeline(selectedObject.timeline).map(i => (
                      <div key={i.title} className="relative">
                        <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-atlas-void border border-emerald-400" />
                        <div className="text-[10px] font-bold text-emerald-400">{i.year}</div>
                        <div className="text-xs text-white/70">{i.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center mb-4"><div className="w-4 h-4 rounded-full border border-emerald-400/20 animate-pulse" /></div>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Awaiting Command</div>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-6 pt-6 border-t border-white/5">
          <div className="space-y-3">
            <div className="text-[10px] uppercase text-white/40 font-bold">Presets</div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SCENES.slice(0, 2).map(p => (
                <button key={p.id} onClick={() => handleApplyPreset(p)} className="p-2 rounded-xl border border-white/5 bg-white/5 text-left hover:border-emerald-400/30">
                  <div className="text-[10px] font-bold text-white truncate">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={toggleOrbits} className={`rounded-xl py-2 text-[9px] font-bold border ${settings.showOrbits ? "bg-emerald-400/10 border-emerald-400/40 text-emerald-300" : "bg-white/5 border-white/5 text-white/20"}`}>Orbits</button>
              <button onClick={toggleMilkyWay} className={`rounded-xl py-2 text-[9px] font-bold border ${settings.showMilkyWay ? "bg-emerald-400/10 border-emerald-400/40 text-emerald-300" : "bg-white/5 border-white/5 text-white/20"}`}>Galactic</button>
            </div>
            <div className="space-y-2">
              <input type="range" min={0.4} max={1.4} step={0.05} value={settings.starfieldIntensity} onChange={e => updateStarfield(Number(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-emerald-400 rounded-full" />
              <input type="range" min={0.2} max={2} step={0.05} value={settings.orbitSpeed} onChange={e => updateOrbitSpeed(Number(e.target.value))} className="w-full h-1 bg-white/5 appearance-none accent-emerald-400 rounded-full" />
            </div>
          </div>
        </div>
      </aside>

      <Dialog open={menuOpen} onClose={setMenuOpen} className="relative z-50">
        <div className="fixed inset-0 bg-atlas-void/90 backdrop-blur-md" />
        <div className="fixed inset-0 flex items-center justify-center p-6">
          <Dialog.Panel className="w-full max-w-sm glass-panel rounded-3xl p-8 space-y-8 animate-fade-in">
            <h2 className="text-xl font-bold text-white uppercase">System Menu</h2>
            <div className="grid gap-3">
              {MODES.map(m => (
                <button key={m.id} onClick={() => { setMode(m.id); setMenuOpen(false); }} className={`p-4 rounded-2xl border ${m.id === mode ? "bg-emerald-400/10 border-emerald-400/40" : "bg-white/5 border-white/5"}`}>
                  <div className={`text-sm font-bold ${m.id === mode ? "text-emerald-300" : "text-white"}`}>{m.name}</div>
                  <div className="text-[10px] text-white/40">{m.description}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setMenuOpen(false)} className="w-full rounded-2xl bg-white text-atlas-void py-3.5 text-[10px] font-bold uppercase">Resume Mission</button>
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
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{selectedObject.type}</span>
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
