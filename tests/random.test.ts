import { hashStringToSeed, mulberry32 } from "@/lib/random";

describe("hashStringToSeed + mulberry32", () => {
  it("generates deterministic sequences for the same seed", () => {
    const seed = hashStringToSeed("alpha");
    const rng1 = mulberry32(seed);
    const rng2 = mulberry32(seed);

    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
  });

  it("keeps outputs in [0, 1) and varies across seeds", () => {
    const rngA = mulberry32(hashStringToSeed("A"));
    const rngB = mulberry32(hashStringToSeed("B"));
    const a = rngA();
    const b = rngB();

    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(1);
    expect(Math.abs(a - b)).toBeGreaterThan(0);
  });
});
