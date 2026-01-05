import type { SceneSnapshot } from "@/lib/scene-snapshot";

export type PresetScene = {
  id: string;
  name: string;
  description: string;
  snapshot: SceneSnapshot;
  tourSequenceId?: string;
};

export const TOUR_SEQUENCES: Record<string, string[]> = {
  solar: [
    "sun",
    "mercury",
    "venus",
    "earth",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
  ],
  deep: ["aries-nebula", "sagittarius-nebula", "andromeda"],
};

const makeSnapshot = (data: Partial<SceneSnapshot>): SceneSnapshot => ({
  version: 1,
  createdAt: new Date().toISOString(),
  settings: {},
  ...data,
});

export const PRESET_SCENES: PresetScene[] = [
  {
    id: "solar-overview",
    name: "太阳系全景",
    description: "从外侧俯瞰太阳系整体结构",
    snapshot: makeSnapshot({
      camera: { position: [0, 14, 70], target: [0, 0, 0] },
    }),
  },
  {
    id: "earth-closeup",
    name: "地月系统",
    description: "聚焦地球与月球",
    snapshot: makeSnapshot({ selectedId: "earth" }),
  },
  {
    id: "outer-giants",
    name: "外行星群",
    description: "聚焦木星与土星",
    snapshot: makeSnapshot({ selectedId: "jupiter" }),
  },
  {
    id: "milky-way",
    name: "银河视角",
    description: "淡淡银河带与远景星野",
    snapshot: makeSnapshot({
      camera: { position: [0, 30, 150], target: [0, 0, 0] },
      settings: { showMilkyWay: true },
    }),
  },
  {
    id: "zodiac-nebula",
    name: "黄道星云",
    description: "星座星云的分布区域",
    snapshot: makeSnapshot({ selectedId: "sagittarius-nebula" }),
  },
  {
    id: "auto-tour",
    name: "自动漫游",
    description: "按序浏览太阳系主要天体",
    snapshot: makeSnapshot({
      camera: { position: [0, 14, 70], target: [0, 0, 0] },
    }),
    tourSequenceId: "solar",
  },
];
