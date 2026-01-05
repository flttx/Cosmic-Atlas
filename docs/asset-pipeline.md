# Asset Pipeline

This project supports KTX2 textures and glTF compression.

## Runtime KTX2 transcoder

Copy the Basis transcoder used by KTX2Loader:

```bash
pnpm assets:setup
```

This populates `public/basis` with `basis_transcoder.js` and `basis_transcoder.wasm`.

## Draco decoder (offline)

Copy Draco decoder files from three.js to `public/draco`:

```bash
pnpm assets:copy-draco
```

`useGLTF` is configured to load Draco from `/draco/`, so offline运行无需外部 CDN。

## Fetch CC0 assets (Poly Haven)

```bash
pnpm assets:fetch
```

This downloads 4K textures, HDRI, and models into `public/assets`.

## Fetch NASA public-domain textures

```bash
pnpm assets:fetch-nasa
pnpm assets:build-nasa
pnpm assets:convert-nasa
```

This downloads NASA diffuse/topography/starfield, builds normal/roughness maps,
and converts them to KTX2.

Note: the diffuse source defaults to `land_ocean_ice_2048.jpg` for faster
downloads. Use `pnpm assets:fetch-nasa -- -DiffuseFile land_ocean_ice_8192.png`
if you want the larger PNG source.

## Fetch NASA image gallery (planets/nebula/comet/satellite)

```bash
pnpm assets:fetch-gallery
pnpm assets:convert-gallery
```

This queries NASA's image library for planet textures plus nebula/comet/satellite
images and converts them to 4K KTX2 textures.

## Fetch NASA 3D models (ISS/Hubble/JWST/Voyager)

```bash
pnpm assets:fetch-models
```

## Optional: Solar System Scope planet textures

```bash
pnpm assets:fetch-solar
pnpm assets:convert-solar
```

This downloads 4K planet maps (Mercury–Neptune, Moon, Sun) plus the Saturn ring
map, then converts them to KTX2. Use when you prefer Solar System Scope sources.

## glTF compression (gltf-transform)

Inspect a model:

```bash
pnpm assets:inspect -- input.glb
```

Meshopt compression:

```bash
pnpm assets:gltf:meshopt -- input.glb output.glb
```

Full optimize (includes meshopt by default):

```bash
pnpm assets:gltf:optimize -- input.glb output.glb --compress meshopt
```

KTX2 ETC1S textures inside glTF (requires KTX-Software toktx in PATH):

```bash
pnpm assets:gltf:etc1s -- input.glb output.glb
```

KTX2 UASTC textures (useful for normal maps):

```bash
pnpm assets:gltf:uastc -- input.glb output.glb
```

Recommended pipeline for CC0 models:

```bash
pnpm assets:gltf:meshopt -- input.gltf temp.glb
pnpm assets:gltf:etc1s -- temp.glb output.glb
```

## Standalone texture conversion (toktx)

Install KTX-Software (Windows local install):

```bash
pnpm assets:install-ktx
```

Color textures (albedo, starfield):

```bash
toktx --t2 --encode etc1s --genmipmap output.ktx2 input.jpg
```

Data textures (normal, roughness, metallic):

```bash
toktx --t2 --encode uastc --uastc_quality 2 --genmipmap output.ktx2 input.png
```

## Runtime wiring

- Set `TEXTURE_ASSETS.*.path` to the .ktx2 file.
- Keep `enabled: true` once the file exists.
- For KTX2-embedded glTFs, `useGLTF` is configured with KTX2Loader and Meshopt.
- NASA 3D Resources models use Draco compression; `useGLTF(..., true)` loads the default Draco decoders (override with `useGLTF.setDecoderPath` or a local `/draco/` copy for offline use).
