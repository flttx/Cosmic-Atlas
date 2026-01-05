import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

// Batch Horizons vectors via your Edge proxy: /api/horizons
// Adjust targets as needed.
const targets = [
  { id: "10", label: "Sun" },
  { id: "399", label: "Earth" },
  { id: "499", label: "Mars" },
  { id: "599", label: "Jupiter" },
  { id: "699", label: "Saturn" },
  { id: "799", label: "Uranus" },
  { id: "899", label: "Neptune" },
  { id: "901", label: "Halley Comet" },
];

const start = "2024-01-01";
const stop = "2024-01-02";
const step = "6h";
const endpoint = "http://localhost:3000/api/horizons";

const run = async () => {
  const outDir = path.join(process.cwd(), "external", "horizons");
  fs.mkdirSync(outDir, { recursive: true });

  for (const t of targets) {
    const url = `${endpoint}?command=${t.id}&ephem_type=vectors&center=500@10&start_time=${start}&stop_time=${stop}&step_size=${step}&make_ephem=YES&vec_table=1`;
    console.log(`-> ${t.label} (${t.id})`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  failed: ${res.status}`);
      continue;
    }
    const json = await res.json();
    fs.writeFileSync(
      path.join(outDir, `${t.id}.json`),
      JSON.stringify(json, null, 2),
      "utf8",
    );
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
