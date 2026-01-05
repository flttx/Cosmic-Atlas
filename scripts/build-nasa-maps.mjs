import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const root = process.cwd();
const texturesDir = path.join(root, "public", "assets", "textures");
const topoPath = path.join(texturesDir, "nasa_earth_topo_5400.jpg");
const normalPath = path.join(texturesDir, "earth_normal_4k.png");
const roughnessPath = path.join(texturesDir, "earth_roughness_4k.png");
const heightPath = path.join(texturesDir, "earth_height_4k.png");

const targetWidth = 4096;
const targetHeight = 2048;

const buffer = await readFile(topoPath);
const decoded = jpeg.decode(buffer, { useTArray: true });

if (!decoded || !decoded.width || !decoded.height) {
  throw new Error("Failed to decode topo image.");
}

const { width, height, data } = decoded;
const gray = new Float32Array(width * height);

for (let i = 0; i < width * height; i += 1) {
  const idx = i * 4;
  const r = data[idx] / 255;
  const g = data[idx + 1] / 255;
  const b = data[idx + 2] / 255;
  gray[i] = r * 0.2126 + g * 0.7152 + b * 0.0722;
}

const resized = new Float32Array(targetWidth * targetHeight);
const xScale = (width - 1) / (targetWidth - 1);
const yScale = (height - 1) / (targetHeight - 1);

for (let y = 0; y < targetHeight; y += 1) {
  const srcY = y * yScale;
  const y0 = Math.floor(srcY);
  const y1 = Math.min(y0 + 1, height - 1);
  const wy = srcY - y0;
  const row0 = y0 * width;
  const row1 = y1 * width;

  for (let x = 0; x < targetWidth; x += 1) {
    const srcX = x * xScale;
    const x0 = Math.floor(srcX);
    const x1 = Math.min(x0 + 1, width - 1);
    const wx = srcX - x0;

    const v00 = gray[row0 + x0];
    const v10 = gray[row0 + x1];
    const v01 = gray[row1 + x0];
    const v11 = gray[row1 + x1];

    const v0 = v00 * (1 - wx) + v10 * wx;
    const v1 = v01 * (1 - wx) + v11 * wx;
    resized[y * targetWidth + x] = v0 * (1 - wy) + v1 * wy;
  }
}

const normalPng = new PNG({ width: targetWidth, height: targetHeight });
const roughPng = new PNG({ width: targetWidth, height: targetHeight });
const heightPng = new PNG({ width: targetWidth, height: targetHeight });

const strength = 6.0;

const sample = (x, y) => {
  const wrappedX = (x + targetWidth) % targetWidth;
  const clampedY = Math.max(0, Math.min(targetHeight - 1, y));
  return resized[clampedY * targetWidth + wrappedX];
};

for (let y = 0; y < targetHeight; y += 1) {
  for (let x = 0; x < targetWidth; x += 1) {
    const hL = sample(x - 1, y);
    const hR = sample(x + 1, y);
    const hU = sample(x, y - 1);
    const hD = sample(x, y + 1);

    const dx = (hR - hL) * strength;
    const dy = (hD - hU) * strength;

    const nx = -dx;
    const ny = -dy;
    const nz = 1;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    const r = Math.round(((nx / len) * 0.5 + 0.5) * 255);
    const g = Math.round(((ny / len) * 0.5 + 0.5) * 255);
    const b = Math.round(((nz / len) * 0.5 + 0.5) * 255);

    const rough = Math.min(1, Math.max(0, 0.35 + resized[y * targetWidth + x] * 0.65));
    const roughByte = Math.round(rough * 255);
    const heightByte = Math.round(resized[y * targetWidth + x] * 255);

    const idx = (y * targetWidth + x) * 4;
    normalPng.data[idx] = r;
    normalPng.data[idx + 1] = g;
    normalPng.data[idx + 2] = b;
    normalPng.data[idx + 3] = 255;

    roughPng.data[idx] = roughByte;
    roughPng.data[idx + 1] = roughByte;
    roughPng.data[idx + 2] = roughByte;
    roughPng.data[idx + 3] = 255;

    heightPng.data[idx] = heightByte;
    heightPng.data[idx + 1] = heightByte;
    heightPng.data[idx + 2] = heightByte;
    heightPng.data[idx + 3] = 255;
  }
}

await writeFile(normalPath, PNG.sync.write(normalPng));
await writeFile(roughnessPath, PNG.sync.write(roughPng));
await writeFile(heightPath, PNG.sync.write(heightPng));

console.log("Generated earth normal/roughness maps.");
