import {
  BASE_DAYS_PER_SECOND,
  orbitRadius,
  resolveOrbitOffset,
  resolveTargetPosition,
  type SceneTarget,
} from "@/data/scene-targets";

const makeTarget = (partial: Partial<SceneTarget>): SceneTarget => ({
  id: "id",
  name: "mock",
  kind: "solar",
  type: "planet",
  position: [0, 0, 0],
  radius: 1,
  description: "mock",
  ...partial,
});

describe("resolveOrbitOffset", () => {
  it("keeps circular orbit length and phase", () => {
    const orbit = {
      centerId: "sun",
      radius: orbitRadius(1),
      periodDays: 100,
      inclinationDeg: 0,
      phaseDeg: 0,
    };
    const start = resolveOrbitOffset(orbit, 0);
    expect(start[0]).toBeCloseTo(orbit.radius, 6);
    expect(start[2]).toBeCloseTo(0, 6);

    // One full orbital period later -> back to start
    const elapsed = orbit.periodDays / BASE_DAYS_PER_SECOND;
    const fullCycle = resolveOrbitOffset(orbit, elapsed);
    expect(fullCycle[0]).toBeCloseTo(start[0], 6);
    expect(fullCycle[2]).toBeCloseTo(start[2], 6);
  });

  it("handles eccentricity and inclination tilt", () => {
    const orbit = {
      centerId: "sun",
      radius: 10,
      periodDays: 200,
      inclinationDeg: 30,
      eccentricity: 0.2,
      phaseDeg: 0,
    };

    // At theta=0 should be periapsis: a*(1-e)
    const periapsis = resolveOrbitOffset(orbit, 0);
    expect(periapsis[0]).toBeCloseTo(orbit.radius * (1 - orbit.eccentricity!), 4);
    expect(periapsis[1]).toBeCloseTo(0, 4);

    // Quarter phase should produce tilt on y
    const quarterElapsed = orbit.periodDays / (4 * BASE_DAYS_PER_SECOND);
    const quarter = resolveOrbitOffset(orbit, quarterElapsed);
    expect(Math.abs(quarter[1])).toBeGreaterThan(0);
  });
});

describe("resolveTargetPosition", () => {
  it("recursively resolves nested centers (e.g., moon around earth around sun)", () => {
    const sun = makeTarget({ id: "sun", name: "Sun", kind: "solar", type: "star", position: [0, 0, 0], radius: 2 });
    const earth = makeTarget({
      id: "earth",
      name: "Earth",
      orbit: { centerId: "sun", radius: orbitRadius(1), periodDays: 365 },
      position: [orbitRadius(1), 0, 0],
    });
    const moon = makeTarget({
      id: "moon",
      name: "Moon",
      orbit: { centerId: "earth", radius: 2, periodDays: 27.3 },
      position: [2, 0, 0],
    });
    const map: Record<string, SceneTarget> = { sun, earth, moon };

    const pos = resolveTargetPosition(moon, 0, map);
    expect(pos[0]).toBeCloseTo(orbitRadius(1) + 2, 6);
    expect(pos[1]).toBeCloseTo(0, 6);
    expect(pos[2]).toBeCloseTo(0, 6);
  });
});
