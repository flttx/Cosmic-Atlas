import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const texturesDir = path.join(root, "public", "assets", "textures");

const args = process.argv.slice(2);
const force = args.includes("--force");

const tasks = [
  { query: "Sun texture", count: 1, prefix: "sun_diffuse_4k" },
  { query: "Mercury global mosaic", count: 1, prefix: "mercury_diffuse_4k" },
  { query: "Venus global view", count: 1, prefix: "venus_diffuse_4k" },
  { query: "Moon global mosaic", count: 1, prefix: "moon_diffuse_4k" },
  { query: "Mars global mosaic", count: 1, prefix: "mars_diffuse_4k" },
  { query: "Jupiter planet", count: 1, prefix: "jupiter_diffuse_4k" },
  { query: "Saturn planet", count: 1, prefix: "saturn_diffuse_4k" },
  { query: "Saturn ring", count: 1, prefix: "saturn_ring_color_4k" },
  { query: "Uranus planet", count: 1, prefix: "uranus_diffuse_4k" },
  { query: "Neptune global view", count: 1, prefix: "neptune_diffuse_4k" },
  { query: "nebula", count: 12, prefix: "zodiac_nebula" },
  { query: "Halley comet", count: 1, prefix: "halley_comet_4k" },
  { query: "International Space Station", count: 1, prefix: "iss_4k" },
  { query: "Hubble Space Telescope", count: 1, prefix: "hubble_4k" },
];

const preferredSuffixes = [
  "~orig.jpg",
  "~large.jpg",
  "~medium.jpg",
  ".jpg",
  ".jpeg",
  ".png",
];

const ensureDir = async () => {
  await mkdir(texturesDir, { recursive: true });
};

const fileExists = async (target) => {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
};

const pickAssetUrl = (urls) => {
  for (const suffix of preferredSuffixes) {
    const match = urls.find((url) => url.endsWith(suffix));
    if (match) {
      return match;
    }
  }
  return urls[0];
};

const downloadFile = async (url, dest) => {
  if (!force && (await fileExists(dest))) {
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureDir();
  await writeFile(dest, buffer);
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed ${url}: ${response.status}`);
  }
  return response.json();
};

const run = async () => {
  await ensureDir();

  for (const task of tasks) {
    const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(
      task.query,
    )}&media_type=image`;
    const searchData = await fetchJson(searchUrl);
    const items = searchData.collection?.items ?? [];
    if (items.length === 0) {
      console.warn(`No results for ${task.query}`);
      continue;
    }

    for (let index = 0; index < task.count; index += 1) {
      const item = items[index];
      if (!item?.data?.[0]?.nasa_id) {
        continue;
      }
      const nasaId = item.data[0].nasa_id;
      const assetUrl = `https://images-api.nasa.gov/asset/${nasaId}`;
      const assetData = await fetchJson(assetUrl);
      const urls = (assetData.collection?.items ?? [])
        .map((entry) => entry.href)
        .filter(Boolean);
      if (urls.length === 0) {
        continue;
      }

      const picked = pickAssetUrl(urls);
      const ext = path.extname(new URL(picked).pathname) || ".jpg";
      const suffix = task.count > 1 ? `_${index + 1}` : "";
      const fileName = `${task.prefix}${suffix}${ext}`;
      const dest = path.join(texturesDir, fileName);
      await downloadFile(picked, dest);
      console.log(`Downloaded ${fileName}`);
    }
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
