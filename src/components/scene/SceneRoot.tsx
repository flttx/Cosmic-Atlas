"use client";

import {
  AsteroidBelt,
  CometModel,
  CustomTargets,
  DeepSpaceMarkers,
  DeepSpaceNebulaPillars,
  ExplorerShipModel,
  GalaxyDisk,
  NebulaBillboards,
  NebulaVolumes,
  OrbitalStationModel,
  SatelliteModels,
  SolarSystemBodies,
  SpaceEnvironment,
  StarField,
  StarfieldDome,
  MilkyWayBand,
} from "@/components/scene/scene-elements";
import { MODEL_ASSETS, TEXTURE_ASSETS } from "@/data/assets";
import { Effects } from "@/components/scene/Effects";
import { SelectionMarker } from "@/components/scene/SelectionMarker";

export function SceneRoot() {
  const showStarfieldTexture = TEXTURE_ASSETS.starfield.enabled;

  return (
    <>
      <color attach="background" args={["#05080d"]} />
      <fog attach="fog" args={["#05080d", 40, 360]} />
      <ambientLight intensity={0.1} />
      <directionalLight
        intensity={0.35}
        position={[18, 12, 10]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.0004}
      />
      <pointLight intensity={2.8} position={[0, 0, 0]} color="#ffc58a" />
      <SpaceEnvironment />
      <Effects />
      <SelectionMarker />

      <group>
        {showStarfieldTexture ? <StarfieldDome /> : null}
        <StarField />
        <MilkyWayBand />
        <GalaxyDisk />
        <DeepSpaceNebulaPillars />
        <DeepSpaceMarkers />
        <AsteroidBelt />
        <SolarSystemBodies />
        <NebulaBillboards />
        <NebulaVolumes />
        <CometModel />
        <SatelliteModels />
        <CustomTargets />
        {MODEL_ASSETS.orbitalStation.enabled ? <OrbitalStationModel /> : null}
        {MODEL_ASSETS.explorerShip.enabled ? <ExplorerShipModel /> : null}
      </group>
    </>
  );
}
