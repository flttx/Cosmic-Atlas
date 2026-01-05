import type { AppSettings, Telemetry } from "@/components/state/app-state";
import type { SceneTarget } from "@/data/scene-targets";

export type SceneSnapshot = {
  version: 1;
  createdAt: string;
  selectedId?: string;
  settings: Partial<AppSettings>;
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
  };
};

export const buildSceneSnapshot = ({
  settings,
  selectedObject,
  telemetry,
}: {
  settings: AppSettings;
  selectedObject: SceneTarget | null;
  telemetry: Telemetry;
}): SceneSnapshot => ({
  version: 1,
  createdAt: new Date().toISOString(),
  selectedId: selectedObject?.id,
  settings: {
    quality: settings.quality,
    resolutionScale: settings.resolutionScale,
    showStats: settings.showStats,
    showOrbits: settings.showOrbits,
    showMilkyWay: settings.showMilkyWay,
    starfieldIntensity: settings.starfieldIntensity,
    orbitSpeed: settings.orbitSpeed,
    haptics: settings.haptics,
    voice: settings.voice,
    sound: settings.sound,
  },
  camera: {
    position: [
      telemetry.camera.x,
      telemetry.camera.y,
      telemetry.camera.z,
    ],
    target: [telemetry.target.x, telemetry.target.y, telemetry.target.z],
  },
});

export const parseSceneSnapshot = (raw: unknown): SceneSnapshot | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as SceneSnapshot;
  if (data.version !== 1 || !data.settings) {
    return null;
  }
  return data;
};

const toUrlSafeBase64 = (value: string) =>
  value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromUrlSafeBase64 = (value: string) => {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base.length % 4 === 0 ? "" : "=".repeat(4 - (base.length % 4));
  return base + pad;
};

const encodeUtf8 = (value: string) => {
  if (typeof window !== "undefined" && "TextEncoder" in window) {
    const encoder = new TextEncoder();
    return String.fromCharCode(...encoder.encode(value));
  }
  return unescape(encodeURIComponent(value));
};

const decodeUtf8 = (value: string) => {
  if (typeof window !== "undefined" && "TextDecoder" in window) {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }
  return decodeURIComponent(escape(value));
};

export const encodeSceneSnapshot = (snapshot: SceneSnapshot) => {
  const json = JSON.stringify(snapshot);
  if (typeof window === "undefined") {
    return "";
  }
  return toUrlSafeBase64(btoa(encodeUtf8(json)));
};

export const decodeSceneSnapshot = (encoded: string): SceneSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const json = decodeUtf8(atob(fromUrlSafeBase64(encoded)));
    return parseSceneSnapshot(JSON.parse(json));
  } catch {
    return null;
  }
};
