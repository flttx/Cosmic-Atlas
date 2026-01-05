import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve(
  "node_modules",
  "three",
  "examples",
  "jsm",
  "libs",
  "basis",
);
const targetDir = path.resolve("public", "basis");

await mkdir(targetDir, { recursive: true });

const files = ["basis_transcoder.js", "basis_transcoder.wasm"];

for (const file of files) {
  const src = path.join(sourceDir, file);
  const dest = path.join(targetDir, file);
  await cp(src, dest);
}

console.log(`Copied Basis transcoder to ${targetDir}`);
