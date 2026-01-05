export type TextureAsset = {
  path: string;
  enabled: boolean;
  kind: "color" | "data";
};

export type ModelAsset = {
  path: string;
  enabled: boolean;
};

export type HdriAsset = {
  path: string;
  enabled: boolean;
};

export const PLACEHOLDER_TEXTURE = "/assets/textures/placeholder.png";
export const KTX2_TRANSCODER_PATH = "/basis/";

export const TEXTURE_ASSETS: Record<string, TextureAsset> = {
  starfield: {
    path: "/assets/textures/starfield_4k.ktx2",
    enabled: true,
    kind: "color",
  },
  earthDiffuse: {
    path: "/assets/textures/earth_diffuse_4k.ktx2",
    enabled: true,
    kind: "color",
  },
  earthNormal: {
    path: "/assets/textures/earth_normal_4k.ktx2",
    enabled: true,
    kind: "data",
  },
  earthRoughness: {
    path: "/assets/textures/earth_roughness_4k.ktx2",
    enabled: true,
    kind: "data",
  },
};

export const MODEL_ASSETS: Record<string, ModelAsset> = {
  orbitalStation: {
    path: "/assets/models/moon_rock_01_4k.glb",
    enabled: true,
  },
  explorerShip: {
    path: "/assets/models/moon_rock_02_4k.glb",
    enabled: true,
  },
};

export const HDRI_ASSETS: Record<string, HdriAsset> = {
  deepSpace: {
    path: "/assets/hdri/moonless_golf_4k.hdr",
    enabled: true,
  },
};
