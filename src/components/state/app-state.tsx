"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { sceneTargetMap } from "@/data/scene-targets";
import type {
  OrbitSpec,
  SceneTarget,
  SceneTargetType,
} from "@/data/scene-targets";
import {
  deleteModelBlob,
  loadModelBlob,
  saveModelBlob,
} from "@/lib/custom-model-store";
import { decodeSceneSnapshot } from "@/lib/scene-snapshot";

export type ExploreMode =
  | "telescope"
  | "navigator"
  | "orbit"
  | "database"
  | "search"
  | "roam";

export type QualityLevel = "auto" | "high" | "medium" | "low";

export type AppSettings = {
  quality: QualityLevel;
  resolutionScale: number;
  showStats: boolean;
  showOrbits: boolean;
  showMilkyWay: boolean;
  starfieldIntensity: number;
  orbitSpeed: number;
  haptics: boolean;
  voice: boolean;
  sound: boolean;
};

export type Telemetry = {
  fps: number;
  camera: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

export type CustomTargetInput = {
  name: string;
  type: SceneTargetType;
  radius: number;
  description: string;
  orbit?: OrbitSpec;
  position?: [number, number, number];
  modelScale?: number;
  modelRotation?: [number, number, number];
  spinSpeed?: number;
};

type AppStateValue = {
  mode: ExploreMode;
  setMode: (mode: ExploreMode) => void;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  selectedObject: SceneTarget | null;
  setSelectedObject: (object: SceneTarget | null) => void;
  introActive: boolean;
  completeIntro: () => void;
  customTargets: SceneTarget[];
  addCustomTarget: (input: CustomTargetInput, file: File) => Promise<void>;
  removeCustomTarget: (id: string) => Promise<void>;
  cameraResetRequested: boolean;
  requestCameraReset: () => void;
  clearCameraReset: () => void;
  cameraSnapshot: { position: [number, number, number]; target: [number, number, number] } | null;
  requestCameraSnapshot: (snapshot: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;
  clearCameraSnapshot: () => void;
  tourActive: boolean;
  tourSequenceId: string | null;
  startTour: (sequenceId: string) => void;
  stopTour: () => void;
  cameraOverviewRequested: boolean;
  requestCameraOverview: () => void;
  clearCameraOverview: () => void;
  telemetry: Telemetry;
  setTelemetry: (telemetry: Telemetry) => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);
const CUSTOM_TARGET_STORAGE_KEY = "cosmic-atlas-custom-targets";

type CustomTargetRecord = {
  id: string;
  name: string;
  type: SceneTargetType;
  position: [number, number, number];
  orbit?: OrbitSpec;
  radius: number;
  description: string;
  modelId: string;
  modelScale?: number;
  modelRotation?: [number, number, number];
  spinSpeed?: number;
};

const toCustomTarget = (record: CustomTargetRecord): SceneTarget => ({
  id: record.id,
  name: record.name,
  kind: "custom",
  type: record.type,
  position: record.position,
  orbit: record.orbit,
  radius: record.radius,
  description: record.description,
  modelId: record.modelId,
  modelScale: record.modelScale,
  modelRotation: record.modelRotation,
  spinSpeed: record.spinSpeed,
});

const toCustomRecord = (target: SceneTarget): CustomTargetRecord => ({
  id: target.id,
  name: target.name,
  type: target.type as SceneTargetType,
  position: target.position,
  orbit: target.orbit,
  radius: target.radius,
  description: target.description,
  modelId: target.modelId ?? target.id,
  modelScale: target.modelScale,
  modelRotation: target.modelRotation,
  spinSpeed: target.spinSpeed,
});

export function AppStateProvider({ children }: { children: ReactNode }) {
  const initialSnapshot = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const queryScene = params.get("scene");
    const hashScene = window.location.hash.startsWith("#scene=")
      ? window.location.hash.slice(7)
      : null;
    const encoded = queryScene ?? hashScene;
    return encoded ? decodeSceneSnapshot(encoded) : null;
  }, []);

  const [mode, setMode] = useState<ExploreMode>("roam");
  const [introActive, setIntroActive] = useState(!initialSnapshot);
  const [settings, setSettings] = useState<AppSettings>(() => ({
    quality: "auto",
    resolutionScale: 0.85,
      showStats: true,
      showOrbits: true,
      showMilkyWay: true,
      starfieldIntensity: 0.95,
      orbitSpeed: 1,
      haptics: true,
      voice: false,
      sound: true,
      ...initialSnapshot?.settings,
  }));
  const [selectedObject, setSelectedObject] = useState<SceneTarget | null>(() => {
    if (initialSnapshot?.selectedId) {
      return sceneTargetMap[initialSnapshot.selectedId] ?? null;
    }
    return null;
  });
  const [customTargets, setCustomTargets] = useState<SceneTarget[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const raw = window.localStorage.getItem(CUSTOM_TARGET_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as CustomTargetRecord[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map(toCustomTarget);
    } catch {
      return [];
    }
  });
  const customTargetsRef = useRef<SceneTarget[]>([]);
  const modelUrlsRef = useRef(new Map<string, string>());
  const [cameraResetRequested, setCameraResetRequested] = useState(false);
  const [cameraOverviewRequested, setCameraOverviewRequested] = useState(false);
  const [cameraSnapshot, setCameraSnapshot] = useState<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(() => {
    if (initialSnapshot?.camera && !initialSnapshot.selectedId) {
      return initialSnapshot.camera;
    }
    return null;
  });
  const [tourActive, setTourActive] = useState(false);
  const [tourSequenceId, setTourSequenceId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    fps: 60,
    camera: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
  });

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const completeIntro = useCallback(() => {
    setIntroActive(false);
  }, []);

  const persistCustomTargets = useCallback((targets: SceneTarget[]) => {
    if (typeof window === "undefined") {
      return;
    }
    const records: CustomTargetRecord[] = targets
      .filter((target) => target.kind === "custom")
      .map(toCustomRecord);
    window.localStorage.setItem(
      CUSTOM_TARGET_STORAGE_KEY,
      JSON.stringify(records),
    );
  }, []);

  const addCustomTarget = useCallback(
    async (input: CustomTargetInput, file: File) => {
      if (typeof window === "undefined") {
        return;
      }
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const modelId = id;
      await saveModelBlob(modelId, file);
      const modelUrl = URL.createObjectURL(file);
      modelUrlsRef.current.set(id, modelUrl);

      const position = input.position ?? [0, 0, 0];
      const target: SceneTarget = {
        id,
        name: input.name,
        kind: "custom",
        type: input.type,
        position,
        orbit: input.orbit,
        radius: input.radius,
        description: input.description,
        model: modelUrl,
        modelId,
        modelScale: input.modelScale,
        modelRotation: input.modelRotation,
        spinSpeed: input.spinSpeed,
      };

      setCustomTargets((prev) => {
        const next = [...prev, target];
        persistCustomTargets(next);
        return next;
      });
    },
    [persistCustomTargets],
  );

  const removeCustomTarget = useCallback(
    async (id: string) => {
      const target = customTargetsRef.current.find((item) => item.id === id);
      const modelId = target?.modelId ?? id;
      setCustomTargets((prev) => {
        const next = prev.filter((item) => item.id !== id);
        persistCustomTargets(next);
        return next;
      });
      const url = modelUrlsRef.current.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        modelUrlsRef.current.delete(id);
      }
      await deleteModelBlob(modelId);
    },
    [persistCustomTargets],
  );

  const requestCameraReset = useCallback(() => {
    setCameraResetRequested(true);
    setCameraOverviewRequested(false);
    setCameraSnapshot(null);
  }, []);

  const clearCameraReset = useCallback(() => {
    setCameraResetRequested(false);
  }, []);

  const requestCameraOverview = useCallback(() => {
    setCameraOverviewRequested(true);
    setCameraResetRequested(false);
    setCameraSnapshot(null);
  }, []);

  const clearCameraOverview = useCallback(() => {
    setCameraOverviewRequested(false);
  }, []);

  const requestCameraSnapshot = useCallback(
    (snapshot: {
      position: [number, number, number];
      target: [number, number, number];
    }) => {
      setCameraSnapshot(snapshot);
      setCameraResetRequested(false);
      setCameraOverviewRequested(false);
    },
    [],
  );

  const clearCameraSnapshot = useCallback(() => {
    setCameraSnapshot(null);
  }, []);

  const startTour = useCallback((sequenceId: string) => {
    setTourSequenceId(sequenceId);
    setTourActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setTourActive(false);
  }, []);

  useEffect(() => {
    customTargetsRef.current = customTargets;
  }, [customTargets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let active = true;
    const modelUrls = modelUrlsRef.current;
    const targets = customTargetsRef.current;
    if (targets.length === 0) {
      return;
    }

    const resolveModels = async () => {
      for (const target of targets) {
        if (target.model) {
          continue;
        }
        try {
          const blob = await loadModelBlob(target.modelId ?? target.id);
          if (!blob || !active) {
            continue;
          }
          const url = URL.createObjectURL(blob);
          modelUrls.set(target.id, url);
          setCustomTargets((prev) =>
            prev.map((item) =>
              item.id === target.id ? { ...item, model: url } : item,
            ),
          );
        } catch {
          // Ignore missing blobs
        }
      }
    };
    resolveModels();

    return () => {
      active = false;
      modelUrls.forEach((url) => URL.revokeObjectURL(url));
      modelUrls.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      settings,
      updateSettings,
      selectedObject,
      setSelectedObject,
      introActive,
      completeIntro,
      customTargets,
      addCustomTarget,
      removeCustomTarget,
      cameraResetRequested,
      requestCameraReset,
      clearCameraReset,
      cameraSnapshot,
      requestCameraSnapshot,
      clearCameraSnapshot,
      tourActive,
      tourSequenceId,
      startTour,
      stopTour,
      cameraOverviewRequested,
      requestCameraOverview,
      clearCameraOverview,
      telemetry,
      setTelemetry,
    }),
    [
      mode,
      setMode,
      settings,
      updateSettings,
      selectedObject,
      setSelectedObject,
      introActive,
      completeIntro,
      customTargets,
      addCustomTarget,
      removeCustomTarget,
      cameraResetRequested,
      requestCameraReset,
      clearCameraReset,
      cameraSnapshot,
      requestCameraSnapshot,
      clearCameraSnapshot,
      tourActive,
      tourSequenceId,
      startTour,
      stopTour,
      cameraOverviewRequested,
      requestCameraOverview,
      clearCameraOverview,
      telemetry,
      setTelemetry,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
