import type { CelestialObject, CelestialType } from "@/data/celestial";
import { sampleCelestialObjects } from "@/data/celestial";
import { distanceToSceneUnits, raDecToCartesian } from "@/lib/astronomy";

export type SceneTargetKind =
  | "catalog"
  | "solar"
  | "nebula"
  | "comet"
  | "satellite"
  | "custom"
  | "belt";

export type SceneTargetType = CelestialType | "moon" | "comet" | "satellite";

export type TargetFact = {
  label: string;
  value: string;
};

export type TimelineEvent = {
  title: string;
  year: string;
};

export type RingInfo = {
  inner: number;
  outer: number;
  texture?: string;
  opacity?: number;
  color?: string;
};

export type OrbitSpec = {
  centerId: string;
  radius: number;
  periodDays: number;
  inclinationDeg?: number;
  phaseDeg?: number;
  eccentricity?: number;
};

export type SceneTarget = {
  id: string;
  name: string;
  kind: SceneTargetKind;
  type: SceneTargetType;
  position: [number, number, number];
  orbit?: OrbitSpec;
  radius: number;
  description: string;
  color?: string;
  emissive?: string;
  texture?: string;
  normal?: string;
  roughness?: string;
  model?: string;
  modelId?: string;
  modelScale?: number;
  modelRotation?: [number, number, number];
  spinSpeed?: number;
  ring?: RingInfo;
  facts?: TargetFact[];
  timeline?: TimelineEvent[];
  searchKeywords?: string[];
  catalog?: CelestialObject;
};

const typeSize: Record<CelestialType, number> = {
  star: 0.5,
  galaxy: 0.7,
  nebula: 0.6,
  blackhole: 0.55,
  planet: 0.45,
};

export const ORBIT_SCALE = 7;
// Smaller value = slower orbits (scene time vs real orbital period)
export const BASE_DAYS_PER_SECOND = 5;

const toRadians = (deg: number) => (deg * Math.PI) / 180;
export const orbitRadius = (au: number) => ORBIT_SCALE * Math.sqrt(au);

export const resolveOrbitOffset = (
  orbit: OrbitSpec,
  elapsed: number,
  speed = 1,
) => {
  const phase = toRadians(orbit.phaseDeg ?? 0);
  const angularSpeed =
    (2 * Math.PI * BASE_DAYS_PER_SECOND * speed) / orbit.periodDays;
  const theta = angularSpeed * elapsed + phase;
  const eccentricity = orbit.eccentricity ?? 0;
  let radius = orbit.radius;

  if (eccentricity > 0) {
    radius =
      (orbit.radius * (1 - eccentricity * eccentricity)) /
      (1 + eccentricity * Math.cos(theta));
  }

  const x = Math.cos(theta) * radius;
  let z = Math.sin(theta) * radius;
  let y = 0;

  const inclination = toRadians(orbit.inclinationDeg ?? 0);
  if (inclination !== 0) {
    const sin = Math.sin(inclination);
    const cos = Math.cos(inclination);
    const tiltedZ = z * cos;
    y = z * sin;
    z = tiltedZ;
  }

  return [x, y, z] as [number, number, number];
};

type OrbitCacheEntry = { time: number; position: [number, number, number] };
export type OrbitCache = Map<string, OrbitCacheEntry>;
const TIME_EPSILON = 1e-4;

const catalogFacts: Record<string, TargetFact[]> = {
  "orion-nebula": [
    { label: "神话", value: "参宿 · 猎户座" },
    { label: "探索", value: "Hubble / JWST 深空成像" },
  ],
  andromeda: [
    { label: "神话", value: "希腊神话安德洛墨达" },
    { label: "探索", value: "哈勃确认为河外星系 (1923)" },
  ],
  "sagittarius-a": [
    { label: "探索", value: "EHT 拍摄黑洞阴影 (2022)" },
  ],
  "trappist-1": [
    { label: "探索", value: "2017 发现 7 颗类地行星" },
  ],
};

const catalogTimelines: Record<string, TimelineEvent[]> = {
  "orion-nebula": [
    { year: "1610", title: "伽利略首次记录亮度异常" },
    { year: "1848", title: "罗希耶绘制精细结构" },
    { year: "2022", title: "JWST 深场红外图像" },
  ],
  andromeda: [
    { year: "964", title: "阿兹罕《星表》首记“云雾状星云”" },
    { year: "1923", title: "哈勃发现造父变星，证实为河外星系" },
    { year: "1944", title: "核区光谱显示 Seyfert 活动迹象" },
    { year: "2015", title: "PAndAS 外晕结构全景" },
    { year: "2006", title: "Spitzer 红外全景" },
  ],
  "sagittarius-a": [
    { year: "1974", title: "射电源 Sgr A* 被确认" },
    { year: "1995", title: "恒星轨道观测支持超大质量黑洞" },
    { year: "2018", title: "Genzel/Ghez 获诺奖表明黑洞存在" },
    { year: "2022", title: "EHT 公布黑洞阴影" },
  ],
  "trappist-1": [
    { year: "2017", title: "发现 TRAPPIST-1 e/f/g 位于宜居带" },
    { year: "2018", title: "哈勃/斯皮策初步大气观测" },
    { year: "2023", title: "JWST 观测 TRAPPIST-1 b 热相曲线" },
    { year: "2021", title: "JWST 列为大气观测目标" },
  ],
};
export const resolveTargetPositionCached = (
  target: SceneTarget,
  elapsed: number,
  targetMap: Record<string, SceneTarget>,
  cache?: OrbitCache,
  speed = 1,
): [number, number, number] => {
  const cached = cache?.get(target.id);
  if (cached && Math.abs(cached.time - elapsed) < TIME_EPSILON) {
    return cached.position;
  }

  if (!target.orbit) {
    cache?.set(target.id, { time: elapsed, position: target.position });
    return target.position;
  }

  const center = targetMap[target.orbit.centerId];
  const centerPos = center
    ? resolveTargetPositionCached(center, elapsed, targetMap, cache, speed)
    : ([0, 0, 0] as [number, number, number]);
  const [ox, oy, oz] = resolveOrbitOffset(target.orbit, elapsed, speed);
  const position = [
    centerPos[0] + ox,
    centerPos[1] + oy,
    centerPos[2] + oz,
  ] as [number, number, number];
  cache?.set(target.id, { time: elapsed, position });
  return position;
};

export const resolveTargetPosition = (
  target: SceneTarget,
  elapsed: number,
  targetMap: Record<string, SceneTarget>,
  speed = 1,
) => resolveTargetPositionCached(target, elapsed, targetMap, undefined, speed);

const catalogTargets: SceneTarget[] = sampleCelestialObjects.map((object) => {
  const distance = distanceToSceneUnits(object.distanceLy);
  const position = raDecToCartesian(object.ra, object.dec, distance);
  const radius = typeSize[object.type] ?? 0.4;
  return {
    id: object.id,
    name: object.name,
    kind: "catalog",
    type: object.type,
    position,
    radius,
    description: object.description,
    color: "#9ef2da",
    emissive: "#9ef2da",
    catalog: object,
    facts: catalogFacts[object.id],
    timeline: catalogTimelines[object.id],
  };
});

const solarBase = 1.6;
const moonOrbitRadius = solarBase * 2.4;
const satelliteOrbitRadius = solarBase * 1.5;
const jwstOrbitRadius = satelliteOrbitRadius * 2.2;
const deepProbeOrbitRadius = orbitRadius(45);

const solarSystemTargets: SceneTarget[] = [
  {
    id: "sun",
    name: "太阳 Sun",
    kind: "solar",
    type: "star",
    position: [0, 0, 0],
    radius: solarBase * 2.6,
    description: "太阳系中心恒星，提供整体照明与能量基调。",
    texture: "/assets/textures/sun_diffuse_4k.ktx2",
    emissive: "#ffb658",
    searchKeywords: ["taiyang", "ty", "sun"],
    facts: [
      { label: "类型", value: "G2V" },
      { label: "半径", value: "696,340 km" },
      { label: "神话", value: "夸父逐日 / 羿射九日" },
      { label: "探索", value: "Parker Solar Probe" },
    ],
  },
  {
    id: "mercury",
    name: "水星 Mercury",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(0.39), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(0.39),
      periodDays: 88,
      inclinationDeg: 7,
      phaseDeg: 20,
    },
    radius: solarBase * 0.38,
    description: "最靠近太阳的行星，表面岩石纹理明显。",
    texture: "/assets/textures/mercury_diffuse_4k.ktx2",
    searchKeywords: ["shuixing", "sx", "mercury"],
    facts: [
      { label: "公转周期", value: "88 天" },
      { label: "卫星", value: "0" },
      { label: "古称", value: "辰星" },
    ],
  },
  {
    id: "venus",
    name: "金星 Venus",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(0.72), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(0.72),
      periodDays: 225,
      inclinationDeg: 3.4,
      phaseDeg: 70,
    },
    radius: solarBase * 0.95,
    description: "厚重云层覆盖的行星，温室效应明显。",
    texture: "/assets/textures/venus_diffuse_4k.ktx2",
    searchKeywords: ["jinxing", "jx", "venus"],
    facts: [
      { label: "公转周期", value: "225 天" },
      { label: "卫星", value: "0" },
      { label: "古称", value: "太白金星" },
    ],
  },
  {
    id: "earth",
    name: "地球 Earth",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(1), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(1),
      periodDays: 365,
      inclinationDeg: 0,
      phaseDeg: 140,
    },
    radius: solarBase,
    description: "蓝色星球，拥有海陆与云层结构。",
    texture: "/assets/textures/earth_diffuse_4k.ktx2",
    normal: "/assets/textures/earth_normal_4k.ktx2",
    roughness: "/assets/textures/earth_roughness_4k.ktx2",
    searchKeywords: ["diqiu", "dq", "earth", "terra"],
    facts: [
      { label: "公转周期", value: "365 天" },
      { label: "卫星", value: "1" },
      { label: "历史", value: "阿波罗 8 地出照片" },
    ],
  },
  {
    id: "moon",
    name: "月球 Moon",
    kind: "solar",
    type: "moon",
    position: [moonOrbitRadius, 0, 0],
    orbit: {
      centerId: "earth",
      radius: moonOrbitRadius,
      periodDays: 27.3,
      inclinationDeg: 5.1,
      phaseDeg: 10,
    },
    radius: solarBase * 0.27,
    description: "地球唯一的天然卫星，表面布满撞击坑。",
    texture: "/assets/textures/moon_diffuse_4k.ktx2",
    searchKeywords: ["yueqiu", "yq", "moon", "luna"],
    facts: [
      { label: "轨道周期", value: "27.3 天" },
      { label: "所属", value: "地球" },
      { label: "神话", value: "嫦娥奔月 / 玉兔" },
      { label: "探索", value: "中国嫦娥工程" },
    ],
  },
  {
    id: "mars",
    name: "火星 Mars",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(1.52), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(1.52),
      periodDays: 687,
      inclinationDeg: 1.85,
      phaseDeg: 210,
    },
    radius: solarBase * 0.53,
    description: "红色星球，富含氧化铁尘埃。",
    texture: "/assets/textures/mars_diffuse_4k.ktx2",
    searchKeywords: ["huoxing", "hx", "mars"],
    facts: [
      { label: "公转周期", value: "687 天" },
      { label: "卫星", value: "2" },
      { label: "古称", value: "荧惑" },
      { label: "探索", value: "祝融号 / 天问一号" },
    ],
  },
  {
    id: "jupiter",
    name: "木星 Jupiter",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(5.2), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(5.2),
      periodDays: 4333,
      inclinationDeg: 1.3,
      phaseDeg: 260,
    },
    radius: solarBase * 1.8,
    description: "气态巨行星，拥有显著大红斑。",
    texture: "/assets/textures/jupiter_diffuse_4k.ktx2",
    searchKeywords: ["muxing", "mx", "jupiter"],
    facts: [
      { label: "公转周期", value: "11.9 年" },
      { label: "卫星", value: "95+" },
      { label: "古称", value: "岁星" },
      { label: "探索", value: "Juno 朱诺号" },
    ],
  },
  {
    id: "saturn",
    name: "土星 Saturn",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(9.58), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(9.58),
      periodDays: 10759,
      inclinationDeg: 2.5,
      phaseDeg: 320,
    },
    radius: solarBase * 1.5,
    description: "拥有壮观环系的气态巨行星。",
    texture: "/assets/textures/saturn_diffuse_4k.ktx2",
    searchKeywords: ["tuxing", "tx", "saturn"],
    ring: {
      inner: solarBase * 2.0,
      outer: solarBase * 3.2,
      texture: "/assets/textures/saturn_ring_color_4k.ktx2",
      opacity: 0.85,
      color: "#d5c3a2",
    },
    facts: [
      { label: "公转周期", value: "29.4 年" },
      { label: "卫星", value: "146+" },
      { label: "古称", value: "镇星" },
      { label: "探索", value: "Cassini 卡西尼" },
    ],
  },
  {
    id: "uranus",
    name: "天王星 Uranus",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(19.2), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(19.2),
      periodDays: 30685,
      inclinationDeg: 0.8,
      phaseDeg: 30,
    },
    radius: solarBase * 1.1,
    description: "倾斜自转轴明显的冰巨星。",
    texture: "/assets/textures/uranus_diffuse_4k.ktx2",
    searchKeywords: ["tianwangxing", "twx", "uranus"],
    facts: [
      { label: "公转周期", value: "84 年" },
      { label: "卫星", value: "27" },
      { label: "探索", value: "Voyager 2 (1986)" },
    ],
  },
  {
    id: "neptune",
    name: "海王星 Neptune",
    kind: "solar",
    type: "planet",
    position: [orbitRadius(30.1), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(30.1),
      periodDays: 60190,
      inclinationDeg: 1.8,
      phaseDeg: 110,
    },
    radius: solarBase * 1.08,
    description: "深蓝色冰巨星，风暴强烈。",
    texture: "/assets/textures/neptune_diffuse_4k.ktx2",
    searchKeywords: ["haiwangxing", "hwx", "neptune"],
    facts: [
      { label: "公转周期", value: "164.8 年" },
      { label: "卫星", value: "14" },
      { label: "探索", value: "Voyager 2 (1989)" },
    ],
  },
];

const zodiacNebulaTargets: SceneTarget[] = [
  {
    id: "aries-nebula",
    name: "白羊座星云",
    color: "#6ee7ff",
    keywords: ["baiyangzuo", "byz", "aries"],
  },
  {
    id: "taurus-nebula",
    name: "金牛座星云",
    color: "#8ee6c2",
    keywords: ["jinniuzuo", "jnz", "taurus"],
  },
  {
    id: "gemini-nebula",
    name: "双子座星云",
    color: "#f6c98a",
    keywords: ["shuangzizuo", "szz", "gemini"],
  },
  {
    id: "cancer-nebula",
    name: "巨蟹座星云",
    color: "#ffd3a4",
    keywords: ["juxiezuo", "jxz", "cancer"],
  },
  {
    id: "leo-nebula",
    name: "狮子座星云",
    color: "#ff9f9f",
    keywords: ["shizizuo", "szz", "leo"],
  },
  {
    id: "virgo-nebula",
    name: "处女座星云",
    color: "#9cc9ff",
    keywords: ["chunvzuo", "cnz", "virgo"],
  },
  {
    id: "libra-nebula",
    name: "天秤座星云",
    color: "#ffc6f2",
    keywords: ["tianchengzuo", "tcz", "libra"],
  },
  {
    id: "scorpio-nebula",
    name: "天蝎座星云",
    color: "#ff7a66",
    keywords: ["tianxiezuo", "txz", "scorpio"],
  },
  {
    id: "sagittarius-nebula",
    name: "射手座星云",
    color: "#ffd166",
    keywords: ["sheshouzuo", "ssz", "sagittarius"],
  },
  {
    id: "capricorn-nebula",
    name: "摩羯座星云",
    color: "#c3f9c5",
    keywords: ["mojiezuo", "mjz", "capricorn"],
  },
  {
    id: "aquarius-nebula",
    name: "水瓶座星云",
    color: "#8dd3ff",
    keywords: ["shuipingzuo", "spz", "aquarius"],
  },
  {
    id: "pisces-nebula",
    name: "双鱼座星云",
    color: "#9ff4ff",
    keywords: ["shuangyuzuo", "syz", "pisces"],
  },
].map((item, index) => {
  const angle = (index / 12) * Math.PI * 2;
  const radius = 36;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return {
    id: item.id,
    name: item.name,
    kind: "nebula",
    type: "nebula",
    position: [x, 4 + (index % 3) * 2, z],
    radius: 2.2,
    description: "黄道星云区域的可视化锚点。",
    color: item.color,
    texture: `/assets/textures/zodiac_nebula_${index + 1}.ktx2`,
    searchKeywords: item.keywords,
    facts: [
      { label: "类别", value: "黄道星云" },
      { label: "探索", value: "Hubble / JWST 深空成像" },
    ],
  } satisfies SceneTarget;
});

const asteroidBeltTarget: SceneTarget = {
  id: "asteroid-belt",
  name: "小行星带 Asteroid Belt",
  kind: "belt",
  type: "nebula",
  position: [orbitRadius(2.8), 0, 0],
  radius: orbitRadius(2.8) * 0.7,
  description: "位于火星与木星之间的小行星带区域。",
  color: "#9bb3c6",
  searchKeywords: ["xiaoxingdai", "xxd", "asteroid", "belt"],
  facts: [
    { label: "历史", value: "1801 谷神星发现" },
    { label: "探索", value: "Dawn 访问谷神星/灶神星" },
  ],
  timeline: [
    { year: "1801", title: "皮亚齐发现谷神星" },
    { year: "2011", title: "Dawn 抵达灶神星" },
    { year: "2015", title: "Dawn 抵达谷神星" },
  ],
};

const cometTargets: SceneTarget[] = [
  {
    id: "halley",
    name: "哈雷彗星 Halley",
    kind: "comet",
    type: "comet",
    position: [orbitRadius(5.2), 0, 0],
    orbit: {
      centerId: "sun",
      radius: orbitRadius(12),
      periodDays: 27490,
      inclinationDeg: 18,
      phaseDeg: 260,
      eccentricity: 0.7,
    },
    radius: 0.6,
    description: "著名短周期彗星，轨道周期约 76 年。",
    texture: "/assets/textures/halley_comet_4k.ktx2",
    color: "#bfe9ff",
    searchKeywords: ["halei", "hl", "halley", "comet"],
    facts: [
      { label: "轨道周期", value: "约 76 年" },
      { label: "称谓", value: "扫帚星" },
      { label: "历史", value: "公元前240年中国记录" },
      { label: "探索", value: "Giotto (1986)" },
    ],
    timeline: [
      { year: "前240", title: "中国史书记载哈雷彗星" },
      { year: "1682", title: "爱德蒙·哈雷观测并预测回归" },
      { year: "1986", title: "Giotto 探测器近距离飞越" },
    ],
  },
];

const satelliteTargets: SceneTarget[] = [
  {
    id: "iss",
    name: "国际空间站 ISS",
    kind: "satellite",
    type: "satellite",
    position: [satelliteOrbitRadius, 0, 0],
    orbit: {
      centerId: "earth",
      radius: satelliteOrbitRadius,
      periodDays: 0.067,
      inclinationDeg: 51.6,
      phaseDeg: 45,
    },
    radius: 0.25,
    description: "地球近地轨道大型载人空间站。",
    texture: "/assets/textures/iss_4k.ktx2",
    model: "/assets/models/iss.glb",
    modelScale: 0.011,
    color: "#bcd7ff",
    searchKeywords: ["guojikongjianzhan", "gjkjz", "iss", "space station"],
    facts: [
      { label: "轨道高度", value: "约 400 km" },
      { label: "历史", value: "1998 首模块入轨" },
      { label: "探索", value: "2000 起持续载人" },
    ],
    timeline: [
      { year: "1998", title: "曙光号模块升空，首件在轨" },
      { year: "2000", title: "开始连续载人驻留" },
    ],
  },
  {
    id: "hubble",
    name: "哈勃望远镜 HST",
    kind: "satellite",
    type: "satellite",
    position: [satelliteOrbitRadius * 1.15, 0, 0],
    orbit: {
      centerId: "earth",
      radius: satelliteOrbitRadius * 1.15,
      periodDays: 0.067,
      inclinationDeg: 28.5,
      phaseDeg: 160,
    },
    radius: 0.22,
    description: "绕地运行的空间望远镜。",
    texture: "/assets/textures/hubble_4k.ktx2",
    model: "/assets/models/hubble.glb",
    modelScale: 0.001,
    color: "#c9e3ff",
    searchKeywords: ["habo", "hb", "hubble", "hst"],
    facts: [
      { label: "轨道高度", value: "约 540 km" },
      { label: "历史", value: "1990 发射" },
      { label: "探索", value: "哈勃深空场" },
    ],
    timeline: [
      { year: "1990", title: "发现镜面问题后太空行走维修" },
      { year: "1995", title: "哈勃深空场发布" },
    ],
  },
  {
    id: "jwst",
    name: "詹姆斯·韦布望远镜 JWST",
    kind: "satellite",
    type: "satellite",
    position: [jwstOrbitRadius, 0, 0],
    orbit: {
      centerId: "earth",
      radius: jwstOrbitRadius,
      periodDays: 30,
      inclinationDeg: 25,
      phaseDeg: 240,
    },
    radius: 0.24,
    description: "位于日地 L2 附近的红外空间望远镜。",
    model: "/assets/models/jwst.glb",
    modelScale: 0.018,
    color: "#ffe6c8",
    searchKeywords: ["weibo", "jwst", "james webb", "jameswebb"],
    facts: [
      { label: "轨道", value: "L2 近似" },
      { label: "发射", value: "2021" },
      { label: "探索", value: "早期宇宙与星系形成" },
    ],
    timeline: [
      { year: "2021", title: "发射并展开主镜" },
      { year: "2022", title: "发布首批全彩科学图像" },
    ],
  },
  {
    id: "voyager",
    name: "旅行者 1 号 Voyager 1",
    kind: "satellite",
    type: "satellite",
    position: [deepProbeOrbitRadius, 0, 0],
    orbit: {
      centerId: "sun",
      radius: deepProbeOrbitRadius,
      periodDays: 62000,
      inclinationDeg: 35,
      phaseDeg: 120,
      eccentricity: 0.35,
    },
    radius: 0.2,
    description: "深空探测器，已进入星际空间。",
    model: "/assets/models/voyager.glb",
    modelScale: 1.5,
    color: "#f2d6a4",
    searchKeywords: ["lixingzhe", "lxz", "voyager"],
    facts: [
      { label: "任务", value: "行星际/星际空间" },
      { label: "发射", value: "1977" },
      { label: "历史", value: "金唱片载人类信息" },
      { label: "探索", value: "穿越日球层" },
    ],
    timeline: [
      { year: "1979", title: "飞掠木星" },
      { year: "1980", title: "飞掠土星" },
      { year: "2012", title: "进入星际空间" },
    ],
  },
];

export const sceneTargets: SceneTarget[] = [
  ...catalogTargets,
  ...solarSystemTargets,
  ...zodiacNebulaTargets,
  asteroidBeltTarget,
  ...cometTargets,
  ...satelliteTargets,
];

export const sceneTargetMap = sceneTargets.reduce<Record<string, SceneTarget>>(
  (acc, target) => {
    acc[target.id] = target;
    return acc;
  },
  {},
);

export const solarTargets = solarSystemTargets;
export const nebulaTargets = zodiacNebulaTargets;
export const cometTarget = cometTargets[0];
export const satelliteTargetsList = satelliteTargets;
export const asteroidBelt = asteroidBeltTarget;
