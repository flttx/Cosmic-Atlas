export type CelestialType = "star" | "galaxy" | "nebula" | "blackhole" | "planet";

export type CelestialMetadata = {
  temperatureK?: number;
  radiusSolar?: number;
  spectralType?: string;
  massSolar?: number;
  notes?: string;
};

export type CelestialObject = {
  id: string;
  name: string;
  type: CelestialType;
  catalogId: string;
  ra: number;
  dec: number;
  distanceLy: number;
  magnitude: number;
  metadata: CelestialMetadata;
  description: string;
};

export const sampleCelestialObjects: CelestialObject[] = [
  {
    id: "sirius",
    name: "天狼星 Sirius",
    type: "star",
    catalogId: "HIP 32349",
    ra: 101.287,
    dec: -16.716,
    distanceLy: 8.6,
    magnitude: -1.46,
    metadata: {
      temperatureK: 9940,
      radiusSolar: 1.71,
      spectralType: "A1V",
      notes: "夜空中最明亮的恒星之一",
    },
    description:
      "位于大犬座的主序星，蓝白色高温恒星，适合展示高动态范围光照与泛光效果。",
  },
  {
    id: "andromeda",
    name: "仙女座星系 M31",
    type: "galaxy",
    catalogId: "NGC 224",
    ra: 10.684,
    dec: 41.269,
    distanceLy: 2_537_000,
    magnitude: 3.44,
    metadata: {
      notes: "距银河系最近的大型旋涡星系",
    },
    description:
      "肉眼可见的大型旋涡星系，适合演示大尺度 LOD 切换与渐进式加载。",
  },
  {
    id: "orion-nebula",
    name: "猎户座大星云 M42",
    type: "nebula",
    catalogId: "NGC 1976",
    ra: 83.822,
    dec: -5.391,
    distanceLy: 1344,
    magnitude: 4.0,
    metadata: {
      notes: "恒星形成区，富含气体与尘埃",
    },
    description:
      "恒星形成区，适合体积光与气体尘埃的渲染实验。",
  },
  {
    id: "sagittarius-a",
    name: "人马座 A*",
    type: "blackhole",
    catalogId: "Sgr A*",
    ra: 266.417,
    dec: -29.008,
    distanceLy: 26_000,
    magnitude: 0.0,
    metadata: {
      massSolar: 4_300_000,
      notes: "银河系中心超大质量黑洞",
    },
    description:
      "银河系中心的超大质量黑洞，适合引力透镜与吸积盘特效。",
  },
  {
    id: "trappist-1",
    name: "TRAPPIST-1",
    type: "star",
    catalogId: "2MASS J23062928-0502285",
    ra: 346.625,
    dec: -5.041,
    distanceLy: 39.5,
    magnitude: 18.8,
    metadata: {
      temperatureK: 2559,
      radiusSolar: 0.121,
      spectralType: "M8V",
      notes: "拥有多颗类地行星",
    },
    description:
      "低温红矮星系统，适合展示多行星轨道模式。",
  },
];
