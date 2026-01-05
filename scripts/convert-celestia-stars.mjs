/**
 * Converts Celestia stars.dat into a trimmed JSON list without extra deps.
 * Works with Celestia 1.6.x (binary header CELSTARS, version 0x0100).
 */
import fs from "node:fs";
import path from "node:path";

const inputPath =
  process.env.CELESTIA_STARS ||
  path.join(process.cwd(), "external", "celestia", "data", "stars.dat");
const outputPath = path.join(
  process.cwd(),
  "src",
  "data",
  "generated",
  "celestia-stars.json",
);
const limit = Number(process.env.CELESTIA_STARS_LIMIT ?? "2000");

const RECORD_SIZE = 4 + 4 * 3 + 2 + 2; // uint32 catNo + 3 floats + int16 absMag + uint16 spectralType
const HEADER = Buffer.from("CELSTARS");
const deg = (rad) => (rad * 180) / Math.PI;

const spectralClassChars = "OBAFGKMRSNWW?LTC";
const luminosityMap = {
  0: "Ia0",
  1: "Ia",
  2: "Ib",
  3: "II",
  4: "III",
  5: "IV",
  6: "V",
  7: "VI",
};
const wdClasses = ["DA", "DB", "DC", "DO", "DQ", "DZ", "D", "DX"];

function unpackSpectralType(raw) {
  const starType = raw >> 12; // StellarClass::StarType
  const specNibble = (raw >> 8) & 0xf;
  const subclass = (raw >> 4) & 0xf;
  const lum = raw & 0xf;

  if (starType === 0) {
    const cls = spectralClassChars[specNibble] ?? "?";
    const sub = subclass <= 9 ? String(subclass) : "";
    const lumStr = luminosityMap[lum] ? ` ${luminosityMap[lum]}` : "";
    return `${cls}${sub}${lumStr}`.trim();
  }
  if (starType === 1) {
    // White dwarf
    const wd = wdClasses[specNibble] ?? "WD";
    const sub = subclass <= 9 ? String(subclass) : "";
    return `WD${wd === "D" ? "" : wd}${sub}`;
  }
  if (starType === 2) return "Neutron";
  if (starType === 3) return "BlackHole";
  return "Unknown";
}

function parseStars(buffer) {
  if (!buffer.subarray(0, HEADER.length).equals(HEADER)) {
    throw new Error("Invalid stars.dat header");
  }
  let offset = HEADER.length;
  const version = buffer.readUInt16LE(offset);
  offset += 2;
  if (version !== 0x0100) {
    throw new Error(`Unexpected stars.dat version ${version}`);
  }
  const count = buffer.readUInt32LE(offset);
  offset += 4;

  const result = [];
  for (let i = 0; i < count; i++) {
    const base = offset + i * RECORD_SIZE;
    if (base + RECORD_SIZE > buffer.length) break;
    const catalog = buffer.readUInt32LE(base);
    const x = buffer.readFloatLE(base + 4);
    const y = buffer.readFloatLE(base + 8);
    const z = buffer.readFloatLE(base + 12);
    const absMag = buffer.readInt16LE(base + 16) / 256;
    const spectralRaw = buffer.readUInt16LE(base + 18);

    const dist = Math.hypot(x, y, z);
    const raDeg = ((deg(Math.atan2(y, x)) % 360) + 360) % 360;
    const decDeg = dist === 0 ? 0 : deg(Math.asin(z / dist));

    // distance is stored in light-years; derive approximate apparent magnitude.
    const distanceLy = dist;
    const distancePc = distanceLy / 3.26156;
    const apparentMag =
      distancePc > 0 ? absMag + 5 * (Math.log10(distancePc) - 1) : absMag;

    result.push({
      id: catalog ? `HIP ${catalog}` : `STAR-${i}`,
      name: `Star ${catalog || i}`,
      ra: raDeg,
      dec: decDeg,
      magnitude: apparentMag,
      absMagnitude: absMag,
      distanceLy,
      spectralType: unpackSpectralType(spectralRaw),
    });
  }
  return result;
}

const run = () => {
  const buffer = fs.readFileSync(inputPath);
  const stars = parseStars(buffer);

  // Sort by apparent magnitude (brightest first) and trim.
  const sorted = stars
    .filter((s) => Number.isFinite(s.magnitude))
    .sort((a, b) => a.magnitude - b.magnitude)
    .slice(0, limit);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2), "utf8");
  console.log(
    `Parsed ${stars.length} stars, wrote ${sorted.length} brightest to ${outputPath}`,
  );
};

run();
