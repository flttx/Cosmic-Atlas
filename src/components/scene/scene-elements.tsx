"use client";

import { Environment, useGLTF, useKTX2, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKtx2Loader } from "@/components/scene/useKtx2Loader";
import { useAppState, type QualityLevel } from "@/components/state/app-state";
import {
  HDRI_ASSETS,
  KTX2_TRANSCODER_PATH,
  MODEL_ASSETS,
  PLACEHOLDER_TEXTURE,
  TEXTURE_ASSETS,
} from "@/data/assets";
import {
  asteroidBelt,
  cometTarget,
  nebulaTargets,
  satelliteTargetsList,
  sceneTargets,
  sceneTargetMap,
  orbitRadius,
  solarTargets,
} from "@/data/scene-targets";
import type { SceneTarget } from "@/data/scene-targets";
import { hashStringToSeed, mulberry32 } from "@/lib/random";
import { getOrbitPosition } from "@/lib/orbit-cache";

const isKtx2Texture = (path: string) => path.toLowerCase().endsWith(".ktx2");
const createRadialSpriteTexture = () => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const maxDist = Math.hypot(center, center);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.hypot(dx, dy) / maxDist;
      const falloff = Math.max(0, 1 - dist);
      const alpha = Math.min(1, falloff * falloff);
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};
const createGalaxyDustTexture = () => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const rand = mulberry32(hashStringToSeed("galaxy-dust"));

  for (let y = 0; y < size; y += 1) {
    const v = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1)) * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      const band = Math.exp(-(v * v) * 18);
      const falloff = Math.max(0, 1 - r);
      const noise = rand() * 0.7 + rand() * 0.3;
      const alpha = Math.min(1, band * falloff * Math.pow(noise, 1.6));

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(150 + noise * 90);
      data[idx + 1] = Math.round(180 + noise * 70);
      data[idx + 2] = Math.round(230 + noise * 25);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};
const createDarkLaneTexture = () => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const rand = mulberry32(hashStringToSeed("galaxy-dark-lane"));

  for (let y = 0; y < size; y += 1) {
    const v = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1)) * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      const band = Math.exp(-(v * v) * 28);
      const falloff = Math.max(0, 1 - r);
      const noise = rand() * 0.8 + rand() * 0.2;
      const alpha = Math.min(1, band * falloff * Math.pow(noise, 1.4));

      const idx = (y * size + x) * 4;
      data[idx] = 5;
      data[idx + 1] = 10;
      data[idx + 2] = 15;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};
const NEBULA_SPRITE = createRadialSpriteTexture();
const GALAXY_DUST_TEXTURE = createGalaxyDustTexture();
const GALAXY_DARK_LANE_TEXTURE = createDarkLaneTexture();
const DEEP_SPACE_NEBULA_TEXTURES = [
  "/assets/textures/zodiac_nebula_3.ktx2",
  "/assets/textures/zodiac_nebula_5.ktx2",
  "/assets/textures/zodiac_nebula_7.ktx2",
  "/assets/textures/zodiac_nebula_9.ktx2",
  "/assets/textures/zodiac_nebula_11.ktx2",
];
const particleScaleByQuality: Record<QualityLevel, number> = {
  high: 1,
  auto: 0.85,
  medium: 0.7,
  low: 0.45,
};
const orbitSegmentsByQuality: Record<QualityLevel, number> = {
  high: 200,
  auto: 160,
  medium: 120,
  low: 0, // 低画质直接关闭轨道线以减少 draw call
};
const useParticleScale = () => {
  const { settings } = useAppState();
  return useMemo(
    () => particleScaleByQuality[settings.quality] ?? 1,
    [settings.quality],
  );
};
const useOrbitSegments = () => {
  const { settings } = useAppState();
  if (!settings.showOrbits) {
    return 0;
  }
  return orbitSegmentsByQuality[settings.quality] ?? 160;
};
const useStarfieldIntensity = () => {
  const { settings } = useAppState();
  return Math.min(1.4, Math.max(0.4, settings.starfieldIntensity));
};

// Use local Draco decoder for offline/air-gapped environments.
useGLTF.setDecoderPath("/draco/");
// Preload common satellite GLBs to avoid首次点击延迟。
satelliteTargetsList
  .filter((target) => target.model)
  .forEach((target) => useGLTF.preload(target.model!, true, true));
useGLTF.setDecoderPath("/draco/");

export function StarField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleScale = useParticleScale();
  const count = Math.max(600, Math.floor(2400 * particleScale));
  const radius = 260;
  const intensity = useStarfieldIntensity();
  const tint = useMemo(
    () => new THREE.Color().setScalar(intensity),
    [intensity],
  );

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }
    const temp = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = radius * (0.4 + Math.random() * 0.6);
      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.cos(phi);
      const z = distance * Math.sin(phi) * Math.sin(theta);

      temp.position.set(x, y, z);
      temp.scale.setScalar(0.3 + Math.random() * 0.7);
      temp.updateMatrix();
      meshRef.current.setMatrixAt(i, temp.matrix);

      const hue = 0.55 + Math.random() * 0.2;
      color.setHSL(hue, 0.4, 0.75 + Math.random() * 0.15);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [count, radius]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.005;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      raycast={() => null}
    >
      <sphereGeometry args={[0.08, 6, 6]} />
      <meshBasicMaterial vertexColors toneMapped={false} color={tint} />
    </instancedMesh>
  );
}

export function MilkyWayBand() {
  const meshRef = useRef<THREE.Points>(null);
  const particleScale = useParticleScale();
  const count = Math.max(800, Math.floor(3200 * particleScale));
  const rand = useMemo(() => mulberry32(hashStringToSeed("milky-way-band")), []);
  const intensity = useStarfieldIntensity();

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color("#b5dfff");
    const dustColor = new THREE.Color("#7cb0ff");

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      const theta = rand() * Math.PI * 2;
      const radius = 240 + rand() * 40;
      const latitude = (rand() - 0.5) * 0.25; // thin band
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const y = latitude * radius;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      const mix = rand();
      const color = baseColor.clone().lerp(dustColor, mix);
      const shade = 0.75 + rand() * 0.25;
      colors[idx] = color.r * shade;
      colors[idx + 1] = color.g * shade;
      colors[idx + 2] = color.b * shade;
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, [count, rand]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.003;
    }
  });

  return (
    <points ref={meshRef} raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial
        size={0.55}
        sizeAttenuation
        vertexColors
        transparent
        opacity={Math.min(0.75, 0.35 + intensity * 0.3)}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={NEBULA_SPRITE}
        alphaMap={NEBULA_SPRITE}
        alphaTest={0.02}
      />
    </points>
  );
}

function StarfieldDomeImage() {
  const rawTexture = useTexture(TEXTURE_ASSETS.starfield.path);
  const intensity = useStarfieldIntensity();
  const tint = useMemo(() => new THREE.Color().setScalar(intensity), [intensity]);

  const texture = useMemo(() => {
    const cloned = rawTexture.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[120, 64, 64]} />
      <meshBasicMaterial
        map={texture}
        color={tint}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function StarfieldDomeKtx2() {
  const rawTexture = useKTX2(
    TEXTURE_ASSETS.starfield.path,
    KTX2_TRANSCODER_PATH,
  );
  const intensity = useStarfieldIntensity();
  const tint = useMemo(() => new THREE.Color().setScalar(intensity), [intensity]);

  const texture = useMemo(() => {
    const cloned = rawTexture.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[120, 64, 64]} />
      <meshBasicMaterial
        map={texture}
        color={tint}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}

export function StarfieldDome() {
  return isKtx2Texture(TEXTURE_ASSETS.starfield.path) ? (
    <StarfieldDomeKtx2 />
  ) : (
    <StarfieldDomeImage />
  );
}

export function SpaceEnvironment() {
  if (!HDRI_ASSETS.deepSpace.enabled) {
    return null;
  }
  return <Environment files={HDRI_ASSETS.deepSpace.path} background={false} />;
}

export function OrbitalStationModel() {
  const ktx2Loader = useKtx2Loader();
  const { scene } = useGLTF(
    MODEL_ASSETS.orbitalStation.path,
    false,
    true,
    (loader) => loader.setKTX2Loader(ktx2Loader),
  );

  return <primitive object={scene} position={[-6, -2, -6]} scale={0.9} />;
}

export function ExplorerShipModel() {
  const ktx2Loader = useKtx2Loader();
  const { scene } = useGLTF(
    MODEL_ASSETS.explorerShip.path,
    false,
    true,
    (loader) => loader.setKTX2Loader(ktx2Loader),
  );

  return <primitive object={scene} position={[4, 1, -4]} scale={0.8} />;
}

export function GalaxyDisk() {
  const { settings } = useAppState();
  const intensity = useStarfieldIntensity();

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: GALAXY_DUST_TEXTURE,
        color: new THREE.Color("#a7c8ff").multiplyScalar(0.9),
        transparent: true,
        opacity: Math.min(0.85, 0.35 + intensity * 0.35),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [intensity],
  );
  const darkMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: GALAXY_DARK_LANE_TEXTURE,
        color: new THREE.Color("#05080d"),
        transparent: true,
        opacity: Math.min(0.6, 0.2 + intensity * 0.2),
        blending: THREE.MultiplyBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [intensity],
  );

  useEffect(
    () => () => {
      material.dispose();
      darkMaterial.dispose();
    },
    [material, darkMaterial],
  );

  if (!settings.showMilkyWay) {
    return null;
  }

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <mesh material={material}>
        <planeGeometry args={[520, 520, 1, 1]} />
      </mesh>
      <mesh material={material} rotation={[0.08, 0.2, 0]}>
        <planeGeometry args={[480, 480, 1, 1]} />
      </mesh>
      <mesh material={darkMaterial} position={[0, 0.02, 0]}>
        <planeGeometry args={[460, 460, 1, 1]} />
      </mesh>
    </group>
  );
}

function PlanetLodMesh({
  position,
  material,
}: {
  position: [number, number, number];
  material: THREE.MeshStandardMaterial;
}) {
  const lodRef = useRef<THREE.LOD>(null);

  const lod = useMemo(() => {
    const lodObject = new THREE.LOD();

    const high = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 80, 80),
      material,
    );
    high.castShadow = true;
    high.receiveShadow = true;
    lodObject.addLevel(high, 0);

    const mid = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 48, 48),
      material,
    );
    mid.castShadow = true;
    mid.receiveShadow = true;
    lodObject.addLevel(mid, 12);

    const low = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 24, 24),
      material,
    );
    low.castShadow = true;
    low.receiveShadow = true;
    lodObject.addLevel(low, 24);

    return lodObject;
  }, [material]);

  useFrame(({ camera }) => {
    lodRef.current?.update(camera);
  });

  return <primitive object={lod} ref={lodRef} position={position} />;
}

function PlanetLodStandard({ position }: { position: [number, number, number] }) {
  const diffuseEnabled = TEXTURE_ASSETS.earthDiffuse.enabled;
  const normalEnabled = TEXTURE_ASSETS.earthNormal.enabled;
  const roughnessEnabled = TEXTURE_ASSETS.earthRoughness.enabled;

  const [rawDiffuse, rawNormal, rawRoughness] = useTexture([
    diffuseEnabled ? TEXTURE_ASSETS.earthDiffuse.path : PLACEHOLDER_TEXTURE,
    normalEnabled ? TEXTURE_ASSETS.earthNormal.path : PLACEHOLDER_TEXTURE,
    roughnessEnabled ? TEXTURE_ASSETS.earthRoughness.path : PLACEHOLDER_TEXTURE,
  ]);

  const diffuse = useMemo(() => {
    const cloned = rawDiffuse.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawDiffuse]);

  const normal = useMemo(() => {
    const cloned = rawNormal.clone();
    cloned.colorSpace = THREE.NoColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawNormal]);

  const roughness = useMemo(() => {
    const cloned = rawRoughness.clone();
    cloned.colorSpace = THREE.NoColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawRoughness]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: diffuseEnabled ? "#ffffff" : "#6bd9ff",
        roughness: roughnessEnabled ? 1 : 0.45,
        metalness: 0.05,
        emissive: "#0b2430",
        emissiveIntensity: 0.15,
        map: diffuseEnabled ? diffuse : null,
        normalMap: normalEnabled ? normal : null,
        roughnessMap: roughnessEnabled ? roughness : null,
      }),
    [diffuse, normal, roughness, diffuseEnabled, normalEnabled, roughnessEnabled],
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      diffuse.dispose();
      normal.dispose();
      roughness.dispose();
    },
    [diffuse, normal, roughness],
  );

  return <PlanetLodMesh position={position} material={material} />;
}

function PlanetLodKtx2({ position }: { position: [number, number, number] }) {
  const [rawDiffuse, rawNormal, rawRoughness] = useKTX2(
    [
      TEXTURE_ASSETS.earthDiffuse.path,
      TEXTURE_ASSETS.earthNormal.path,
      TEXTURE_ASSETS.earthRoughness.path,
    ],
    KTX2_TRANSCODER_PATH,
  );

  const diffuse = useMemo(() => {
    const cloned = rawDiffuse.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawDiffuse]);

  const normal = useMemo(() => {
    const cloned = rawNormal.clone();
    cloned.colorSpace = THREE.NoColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawNormal]);

  const roughness = useMemo(() => {
    const cloned = rawRoughness.clone();
    cloned.colorSpace = THREE.NoColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawRoughness]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1,
        metalness: 0.05,
        emissive: "#0b2430",
        emissiveIntensity: 0.15,
        map: diffuse,
        normalMap: normal,
        roughnessMap: roughness,
      }),
    [diffuse, normal, roughness],
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      diffuse.dispose();
      normal.dispose();
      roughness.dispose();
    },
    [diffuse, normal, roughness],
  );

  return <PlanetLodMesh position={position} material={material} />;
}

export function PlanetLod({ position }: { position: [number, number, number] }) {
  const diffuseEnabled = TEXTURE_ASSETS.earthDiffuse.enabled;
  const normalEnabled = TEXTURE_ASSETS.earthNormal.enabled;
  const roughnessEnabled = TEXTURE_ASSETS.earthRoughness.enabled;
  const useKtx2 =
    diffuseEnabled &&
    normalEnabled &&
    roughnessEnabled &&
    isKtx2Texture(TEXTURE_ASSETS.earthDiffuse.path) &&
    isKtx2Texture(TEXTURE_ASSETS.earthNormal.path) &&
    isKtx2Texture(TEXTURE_ASSETS.earthRoughness.path);

  return useKtx2 ? (
    <PlanetLodKtx2 position={position} />
  ) : (
    <PlanetLodStandard position={position} />
  );
}

function PlanetAtmosphere({
  radius,
  color,
  scale,
  intensity,
}: {
  radius: number;
  color: string;
  scale: number;
  intensity: number;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(color) },
          intensity: { value: intensity },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          uniform float intensity;
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vPosition);
            
            // Fresnel / Rim-light
            float rim = pow(1.1 - max(dot(vNormal, vec3(0,0,1)), 0.0), 4.0);
            
            // Light source alignment (Sun is at [0,0,0], target is at modelMatrix * pos)
            // For simplicity in the component, we'll use a basic rim that looks good from any angle first
            // But we can refine it to be sun-facing if we pass the sun position or use world normals.
            
            float dotProduct = dot(vNormal, vec3(0, 0, 1));
            float intensityFactor = pow(1.0 - max(dotProduct, 0.0), 3.0);
            
            gl_FragColor = vec4(glowColor, intensityFactor * intensity);
          }
        `,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [color, intensity],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={scale}>
      <sphereGeometry args={[radius, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

const typeColor: Record<string, string> = {
  star: "#b8f9ff",
  galaxy: "#64f5c9",
  nebula: "#31c7b0",
  blackhole: "#f6b679",
  planet: "#5bd8ff",
  moon: "#8bb7ff",
  comet: "#b3e7ff",
  satellite: "#9cc9ff",
};
const ATMOSPHERE_CONFIG: Record<
  string,
  { color: string; scale: number; intensity: number }
> = {
  earth: { color: "#5bd8ff", scale: 1.05, intensity: 0.6 },
  venus: { color: "#f6d2a5", scale: 1.04, intensity: 0.35 },
  mars: { color: "#ff9f7a", scale: 1.03, intensity: 0.25 },
  jupiter: { color: "#f2d6b0", scale: 1.03, intensity: 0.22 },
  saturn: { color: "#f3ddb5", scale: 1.03, intensity: 0.22 },
  uranus: { color: "#a7e6ff", scale: 1.03, intensity: 0.3 },
  neptune: { color: "#8fd6ff", scale: 1.03, intensity: 0.32 },
};

function useKtx2ColorMap(path: string) {
  const rawTexture = useKTX2(path, KTX2_TRANSCODER_PATH);
  return useMemo(() => {
    const cloned = rawTexture.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture]);
}

export function DeepSpaceMarkers() {
  const { selectedObject, setSelectedObject } = useAppState();
  const markers = useMemo(
    () =>
      sceneTargets.filter((target) => target.kind === "catalog"),
    [],
  );

  return (
    <group>
      {markers.map((target) => {
        const selected = selectedObject?.id === target.id;
        const color = typeColor[target.type] ?? target.color ?? "#9ef2da";
        return (
          <mesh
            key={target.id}
            position={target.position}
            scale={selected ? 1.2 : 1}
            onPointerDown={(event) => {
              event.stopPropagation();
              setSelectedObject(target);
            }}
          >
            <sphereGeometry args={[target.radius, 32, 32]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={selected ? 1.2 : 0.35}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function OrbitingGroup({
  target,
  children,
}: {
  target: SceneTarget;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { settings } = useAppState();

  useEffect(() => {
    if (!target.orbit && groupRef.current) {
      groupRef.current.position.set(...target.position);
    }
  }, [target]);

  useFrame((state) => {
    if (!groupRef.current || !target.orbit) {
      return;
    }
    const position = getOrbitPosition(
      target,
      state.clock.elapsedTime,
      settings.orbitSpeed,
    );
    groupRef.current.position.set(...position);
  });

  return <group ref={groupRef}>{children}</group>;
}

function OrbitPath({ target }: { target: SceneTarget }) {
  const segments = useOrbitSegments();
  const geometry = useMemo(() => {
    if (!target.orbit || segments <= 0) {
      return null;
    }
    const points = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const orbit = target.orbit;
      const eccentricity = orbit.eccentricity ?? 0;
      let radius = orbit.radius;
      if (eccentricity > 0) {
        radius =
          (orbit.radius * (1 - eccentricity * eccentricity)) /
          (1 + eccentricity * Math.cos(angle));
      }
      const x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;
      let y = 0;
      const inclination = THREE.MathUtils.degToRad(orbit.inclinationDeg ?? 0);
      if (inclination !== 0) {
        const sin = Math.sin(inclination);
        const cos = Math.cos(inclination);
        const tiltedZ = z * cos;
        y = z * sin;
        z = tiltedZ;
      }
      points.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [segments, target]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry || !target.orbit || segments <= 0) {
    return null;
  }

  const center = sceneTargetMap[target.orbit.centerId];
  return (
    <OrbitingGroup target={center ?? target}>
      <line raycast={() => null}>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color="#1a4037" transparent opacity={0.4} />
      </line>
    </OrbitingGroup>
  );
}

function SolarBody({ target }: { target: (typeof solarTargets)[number] }) {
  const { selectedObject, setSelectedObject } = useAppState();
  const texture = useKtx2ColorMap(target.texture!);
  const selected = selectedObject?.id === target.id;
  const isSun = target.id === "sun";
  const atmosphere = ATMOSPHERE_CONFIG[target.id];
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (isSun ? 0.08 : 0.04);
    }
  });

  return (
    <OrbitingGroup target={target}>
      <mesh
        ref={meshRef}
        castShadow={!isSun}
        receiveShadow={!isSun}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <sphereGeometry args={[target.radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          color="#ffffff"
          roughness={isSun ? 0.2 : 0.7}
          metalness={0.05}
          emissive={target.emissive ?? "#111821"}
          emissiveIntensity={selected ? 0.65 : isSun ? 1 : 0.12}
        />
      </mesh>
      {atmosphere ? (
        <PlanetAtmosphere
          radius={target.radius}
          color={atmosphere.color}
          scale={atmosphere.scale}
          intensity={atmosphere.intensity}
        />
      ) : null}
    </OrbitingGroup>
  );
}

function SaturnRing({ target }: { target: (typeof solarTargets)[number] }) {
  const { setSelectedObject } = useAppState();
  const ringTexturePath = target.ring?.texture ?? PLACEHOLDER_TEXTURE;
  const hasRing = Boolean(target.ring?.texture);
  const texture = useKtx2ColorMap(ringTexturePath);

  useEffect(() => () => texture.dispose(), [texture]);

  if (!hasRing || !target.ring) {
    return null;
  }

  return (
    <OrbitingGroup target={target}>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <ringGeometry args={[target.ring.inner, target.ring.outer, 96]} />
        <meshStandardMaterial
          map={texture}
          color={target.ring.color ?? "#d5c3a2"}
          transparent
          opacity={target.ring.opacity ?? 0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </OrbitingGroup>
  );
}

export function SolarSystemBodies() {
  const { setSelectedObject } = useAppState();
  const earthTarget = solarTargets.find((target) => target.id === "earth");
  const otherTargets = solarTargets.filter((target) => target.id !== "earth");
  const earthBaseRadius = 1.8;
  const orbitTargets = solarTargets.filter((target) => target.id !== "sun");
  const earthAtmosphere = earthTarget ? ATMOSPHERE_CONFIG[earthTarget.id] : null;

  return (
    <group>
      {orbitTargets.map((target) => (
        <OrbitPath key={`${target.id}-orbit`} target={target} />
      ))}
      {earthTarget ? (
        <OrbitingGroup target={earthTarget}>
          <group
            scale={earthTarget.radius / earthBaseRadius}
            onPointerDown={(event) => {
              event.stopPropagation();
              setSelectedObject(earthTarget);
            }}
          >
            <PlanetLod position={[0, 0, 0]} />
            {earthAtmosphere ? (
              <PlanetAtmosphere
                radius={earthBaseRadius}
                color={earthAtmosphere.color}
                scale={earthAtmosphere.scale}
                intensity={earthAtmosphere.intensity}
              />
            ) : null}
          </group>
        </OrbitingGroup>
      ) : null}
      {otherTargets.map((target) => (
        <SolarBody key={target.id} target={target} />
      ))}
      {solarTargets
        .filter((target) => target.ring)
        .map((target) => (
          <SaturnRing key={`${target.id}-ring`} target={target} />
        ))}
    </group>
  );
}

function NebulaVolume({ target }: { target: (typeof nebulaTargets)[number] }) {
  const { selectedObject, setSelectedObject } = useAppState();
  const particleScale = useParticleScale();
  const pointsRef = useRef<THREE.Points>(null);
  const hitRef = useRef<THREE.Mesh>(null);
  const selected = selectedObject?.id === target.id;

  const geometry = useMemo(() => {
    const count = Math.max(400, Math.floor(1400 * particleScale));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(target.color ?? "#9ef2da");
    const rand = mulberry32(hashStringToSeed(target.id));

    for (let i = 0; i < count; i += 1) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const radius = Math.cbrt(rand()) * target.radius * 2.1;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      const idx = i * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      const shade = 0.6 + rand() * 0.5;
      colors[idx] = baseColor.r * shade;
      colors[idx + 1] = baseColor.g * shade;
      colors[idx + 2] = baseColor.b * shade;
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, [particleScale, target.color, target.id, target.radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.03;
      pointsRef.current.rotation.x += delta * 0.01;
    }
  });

  return (
    <group position={target.position}>
      <points ref={pointsRef} raycast={() => null}>
        <primitive object={geometry} attach="geometry" />
        <pointsMaterial
          size={0.35}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          map={NEBULA_SPRITE}
          alphaMap={NEBULA_SPRITE}
          alphaTest={0.02}
        />
      </points>
      <mesh
        ref={hitRef}
        scale={selected ? 1.1 : 1}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <sphereGeometry args={[target.radius * 2.4, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export function NebulaVolumes() {
  return (
    <group>
      {nebulaTargets.map((target) => (
        <NebulaVolume key={target.id} target={target} />
      ))}
    </group>
  );
}

function NebulaBillboard({ target }: { target: (typeof nebulaTargets)[number] }) {
  if (!target.texture) {
    return null;
  }
  return isKtx2Texture(target.texture) ? (
    <NebulaBillboardKtx2 target={target} />
  ) : (
    <NebulaBillboardImage target={target} />
  );
}

function NebulaBillboardBase({
  target,
  rawTexture,
}: {
  target: (typeof nebulaTargets)[number];
  rawTexture: THREE.Texture;
}) {
  const intensity = useStarfieldIntensity();
  const texture = useMemo(() => {
    const cloned = rawTexture.clone();
    cloned.colorSpace = THREE.SRGBColorSpace;
    cloned.wrapS = THREE.ClampToEdgeWrapping;
    cloned.wrapT = THREE.ClampToEdgeWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  const size = target.radius * 7.5;
  return (
    <sprite position={target.position} scale={[size, size, 1]} renderOrder={1}>
      <spriteMaterial
        map={texture}
        color={target.color ?? "#9ef2da"}
        transparent
        opacity={Math.min(0.7, 0.25 + intensity * 0.2)}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

function NebulaBillboardKtx2({
  target,
}: {
  target: (typeof nebulaTargets)[number];
}) {
  const rawTexture = useKTX2(target.texture!, KTX2_TRANSCODER_PATH);
  return <NebulaBillboardBase target={target} rawTexture={rawTexture} />;
}

function NebulaBillboardImage({
  target,
}: {
  target: (typeof nebulaTargets)[number];
}) {
  const rawTexture = useTexture(target.texture!);
  return <NebulaBillboardBase target={target} rawTexture={rawTexture} />;
}

export function NebulaBillboards() {
  return (
    <group>
      {nebulaTargets
        .filter((target) => target.texture)
        .map((target) => (
          <NebulaBillboard key={`${target.id}-billboard`} target={target} />
        ))}
    </group>
  );
}

export function DeepSpaceNebulaPillars() {
  const intensity = useStarfieldIntensity();
  const rawTextures = useKTX2(
    DEEP_SPACE_NEBULA_TEXTURES,
    KTX2_TRANSCODER_PATH,
  );

  const textures = useMemo(
    () =>
      rawTextures.map((raw) => {
        const cloned = raw.clone();
        cloned.colorSpace = THREE.SRGBColorSpace;
        cloned.wrapS = THREE.ClampToEdgeWrapping;
        cloned.wrapT = THREE.ClampToEdgeWrapping;
        cloned.needsUpdate = true;
        return cloned;
      }),
    [rawTextures],
  );

  useEffect(() => () => textures.forEach((texture) => texture.dispose()), [textures]);

  const sprites = useMemo(() => {
    const rand = mulberry32(hashStringToSeed("deep-space-pillars"));
    return Array.from({ length: 7 }, (_, index) => {
      const theta = rand() * Math.PI * 2;
      const radius = 210 + rand() * 70;
      const height = (rand() - 0.5) * 90;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const base = 110 + rand() * 80;
      return {
        id: index,
        position: [x, height, z] as [number, number, number],
        scale: [base * 1.4, base, 1] as [number, number, number],
        rotation: rand() * Math.PI * 2,
        textureIndex: Math.floor(rand() * textures.length),
        tint: new THREE.Color().setHSL(0.56 + rand() * 0.06, 0.5, 0.65),
      };
    });
  }, [textures.length]);

  return (
    <group raycast={() => null}>
      {sprites.map((sprite) => (
        <sprite
          key={`deep-space-${sprite.id}`}
          position={sprite.position}
          scale={sprite.scale}
          rotation={[0, 0, sprite.rotation]}
          renderOrder={-2}
        >
          <spriteMaterial
            map={textures[sprite.textureIndex]}
            color={sprite.tint}
            transparent
            opacity={Math.min(0.5, 0.18 + intensity * 0.18)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

export function CometModel() {
  const { selectedObject, setSelectedObject, settings } = useAppState();
  const particleScale = useParticleScale();
  const nucleusRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Points>(null);
  const selected = selectedObject?.id === cometTarget.id;
  const tailAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const tailDirection = useMemo(() => new THREE.Vector3(), []);

  const tailGeometry = useMemo(() => {
    const count = Math.max(120, Math.floor(400 * particleScale));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(cometTarget.color ?? "#bfe9ff");
    const rand = mulberry32(hashStringToSeed(cometTarget.id));

    for (let i = 0; i < count; i += 1) {
      const idx = i * 3;
      const spread = rand() * 0.6;
      const length = rand() * cometTarget.radius * 6;
      positions[idx] = (rand() - 0.5) * spread;
      positions[idx + 1] = (rand() - 0.5) * spread;
      positions[idx + 2] = length + 0.6;

      const shade = 0.6 + rand() * 0.4;
      colors[idx] = baseColor.r * shade;
      colors[idx + 1] = baseColor.g * shade;
      colors[idx + 2] = baseColor.b * shade;
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, [particleScale]);

  useEffect(() => () => tailGeometry.dispose(), [tailGeometry]);

  useFrame((state, delta) => {
    if (nucleusRef.current) {
      nucleusRef.current.rotation.y += delta * 0.8;
    }
    if (tailRef.current) {
      const current = getOrbitPosition(
        cometTarget,
        state.clock.elapsedTime,
        settings.orbitSpeed,
      );
      const next = getOrbitPosition(
        cometTarget,
        state.clock.elapsedTime + 0.03,
        settings.orbitSpeed,
      );
      tailDirection
        .set(next[0] - current[0], next[1] - current[1], next[2] - current[2])
        .normalize()
        .multiplyScalar(-1);
      tailRef.current.quaternion.setFromUnitVectors(tailAxis, tailDirection);
    }
  });

  return (
    <OrbitingGroup target={cometTarget}>
      <group
        scale={selected ? 1.2 : 1}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(cometTarget);
        }}
      >
        <mesh ref={nucleusRef} castShadow receiveShadow>
          <icosahedronGeometry args={[cometTarget.radius * 0.55, 2]} />
          <meshStandardMaterial
            color="#d9eef6"
            roughness={0.9}
            metalness={0.1}
            emissive="#20363e"
            emissiveIntensity={0.4}
          />
        </mesh>
        <points ref={tailRef}>
          <primitive object={tailGeometry} attach="geometry" />
          <pointsMaterial
            size={0.22}
            sizeAttenuation
            vertexColors
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            map={NEBULA_SPRITE}
            alphaMap={NEBULA_SPRITE}
            alphaTest={0.02}
          />
        </points>
      </group>
    </OrbitingGroup>
  );
}

export function AsteroidBelt() {
  const { selectedObject, setSelectedObject } = useAppState();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleScale = useParticleScale();
  const count = Math.max(600, Math.floor(2000 * particleScale));
  const innerRadius = orbitRadius(2.2);
  const outerRadius = orbitRadius(3.3);
  const thickness = 1.6;
  const selected = selectedObject?.id === asteroidBelt.id;

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }
    const temp = new THREE.Object3D();
    const color = new THREE.Color();
    const rand = mulberry32(hashStringToSeed("asteroid-belt"));

    for (let i = 0; i < count; i += 1) {
      const theta = rand() * Math.PI * 2;
      const radius = innerRadius + rand() * (outerRadius - innerRadius);
      const y = (rand() - 0.5) * thickness;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      temp.position.set(x, y, z);
      temp.scale.setScalar(0.08 + rand() * 0.18);
      temp.updateMatrix();
      meshRef.current.setMatrixAt(i, temp.matrix);

      const shade = 0.35 + rand() * 0.35;
      color.setRGB(0.55 * shade, 0.6 * shade, 0.68 * shade);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [count, innerRadius, outerRadius, thickness]);

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        raycast={() => null}
      >
        <sphereGeometry args={[0.2, 6, 6]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          metalness={0.1}
          emissive={selected ? "#1a2b33" : "#0a1218"}
          emissiveIntensity={selected ? 0.5 : 0.2}
        />
      </instancedMesh>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(asteroidBelt);
        }}
      >
        <torusGeometry
          args={[(innerRadius + outerRadius) / 2, 2.1, 12, 120]}
        />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export function SatelliteModels() {
  return (
    <group>
      {satelliteTargetsList.map((target) => (
        <SatelliteModel key={target.id} target={target} />
      ))}
    </group>
  );
}

export function CustomTargets() {
  const { customTargets } = useAppState();

  if (customTargets.length === 0) {
    return null;
  }

  const orbitTargets = customTargets.filter((target) => target.orbit);

  return (
    <group>
      {orbitTargets.map((target) => (
        <OrbitPath key={`${target.id}-orbit`} target={target} />
      ))}
      {customTargets.map((target) => (
        <CustomTargetItem key={target.id} target={target} />
      ))}
    </group>
  );
}

type SatelliteTarget = (typeof satelliteTargetsList)[number];

function SatelliteModel({
  target,
}: {
  target: SatelliteTarget;
}) {
  return target.model ? (
    <SatelliteGltfModel target={target} />
  ) : (
    <SatellitePrimitiveModel target={target} />
  );
}

function SatelliteGltfModel({ target }: { target: SatelliteTarget }) {
  const { selectedObject, setSelectedObject } = useAppState();
  const ktx2Loader = useKtx2Loader();
  const { scene } = useGLTF(
    target.model!,
    true,
    true,
    (loader) => loader.setKTX2Loader(ktx2Loader),
  );
  const spinRef = useRef<THREE.Group>(null);
  const selected = selectedObject?.id === target.id;
  const scale = (target.modelScale ?? 1) * (selected ? 1.12 : 1);
  const rotation = target.modelRotation ?? [0, 0, 0];

  useFrame((_, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <OrbitingGroup target={target}>
      <group
        scale={scale}
        rotation={rotation}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <group ref={spinRef}>
          <primitive object={scene} />
        </group>
      </group>
    </OrbitingGroup>
  );
}

function SatellitePrimitiveModel({ target }: { target: SatelliteTarget }) {
  const { selectedObject, setSelectedObject } = useAppState();
  const groupRef = useRef<THREE.Group>(null);
  const selected = selectedObject?.id === target.id;

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <OrbitingGroup target={target}>
      <group
        ref={groupRef}
        scale={selected ? 1.25 : 1}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <mesh>
          <boxGeometry args={[0.35, 0.22, 0.22]} />
          <meshStandardMaterial
            color="#c3cedc"
            roughness={0.45}
            metalness={0.6}
          />
        </mesh>
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[0.45, 0.06, 0.28]} />
          <meshStandardMaterial
            color="#2f6b9a"
            roughness={0.4}
            metalness={0.8}
            emissive="#113a5a"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[-0.35, 0, 0]}>
          <boxGeometry args={[0.45, 0.06, 0.28]} />
          <meshStandardMaterial
            color="#2f6b9a"
            roughness={0.4}
            metalness={0.8}
            emissive="#113a5a"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.16, 12]} />
          <meshStandardMaterial
            color="#e3e9f2"
            roughness={0.35}
            metalness={0.5}
          />
        </mesh>
      </group>
    </OrbitingGroup>
  );
}

function CustomTargetItem({ target }: { target: SceneTarget }) {
  if (target.model) {
    return <CustomTargetGltf target={target} />;
  }
  return <CustomTargetPlaceholder target={target} />;
}

function CustomTargetGltf({ target }: { target: SceneTarget }) {
  const { selectedObject, setSelectedObject } = useAppState();
  const ktx2Loader = useKtx2Loader();
  const { scene } = useGLTF(
    target.model!,
    true,
    true,
    (loader) => loader.setKTX2Loader(ktx2Loader),
  );
  const spinRef = useRef<THREE.Group>(null);
  const selected = selectedObject?.id === target.id;
  const spinSpeed = target.spinSpeed ?? 0.3;
  const scale = (target.modelScale ?? 1) * (selected ? 1.1 : 1);
  const rotation = target.modelRotation ?? [0, 0, 0];

  useFrame((_, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * spinSpeed;
    }
  });

  return (
    <OrbitingGroup target={target}>
      <group
        scale={scale}
        rotation={rotation}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <group ref={spinRef}>
          <primitive object={scene} />
        </group>
      </group>
    </OrbitingGroup>
  );
}

function CustomTargetPlaceholder({ target }: { target: SceneTarget }) {
  const { selectedObject, setSelectedObject } = useAppState();
  const selected = selectedObject?.id === target.id;
  const emissive = selected ? "#4df5c5" : "#0d2a24";

  return (
    <OrbitingGroup target={target}>
      <mesh
        scale={selected ? 1.1 : 1}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedObject(target);
        }}
      >
        <sphereGeometry args={[target.radius, 32, 32]} />
        <meshStandardMaterial
          color="#9ef2da"
          emissive={emissive}
          emissiveIntensity={selected ? 0.9 : 0.3}
        />
      </mesh>
    </OrbitingGroup>
  );
}
