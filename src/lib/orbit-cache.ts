import {
  resolveTargetPositionCached,
  sceneTargetMap,
  type OrbitCache,
  type SceneTarget,
} from "@/data/scene-targets";

const orbitCache: OrbitCache = new Map();
let lastTime = -1;
let lastSpeed = 1;
const TIME_EPSILON = 1e-4;

export const getOrbitPosition = (
  target: SceneTarget,
  elapsed: number,
  speed = 1,
): [number, number, number] => {
  if (
    lastTime < 0 ||
    Math.abs(lastTime - elapsed) > TIME_EPSILON ||
    Math.abs(lastSpeed - speed) > 1e-4
  ) {
    orbitCache.clear();
    lastTime = elapsed;
    lastSpeed = speed;
  }
  return resolveTargetPositionCached(
    target,
    elapsed,
    sceneTargetMap,
    orbitCache,
    speed,
  );
};
