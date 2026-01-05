# Cosmic Atlas

High-performance 3D universe explorer built with Next.js, Three.js (R3F), and Tailwind.

## Local Development

1. Install dependencies:

```bash
pnpm install
```

2. Start the local Postgres mirror (Docker):

```bash
docker compose up -d
```

3. Create local env file:

```bash
cp .env.example .env.local
```

4. Run migrations (optional, once schema exists):

```bash
pnpm db:push
```

5. Start the dev server:

```bash
pnpm dev    # 默认端口改为 5401（5400 已占用）
```

## Production (Vercel Postgres)

- Vercel provides `POSTGRES_URL` automatically in production.
- For Drizzle CLI, set `DATABASE_URL` to the same value when running locally.

## Edge API (JPL Horizons)

- Proxy route: `/api/horizons` (Edge runtime) forwards query params to JPL.
- Example:

```text
/api/horizons?command=399&ephem_type=vectors&center=500@10&start_time=2024-01-01&stop_time=2024-01-02&step_size=1h
```

## Assets

Asset folders live in `public/assets`:

- `public/assets/textures`
- `public/assets/models`
- `public/assets/hdri`

Texture/model paths and toggles are defined in `src/data/assets.ts`. Set `enabled: true` after dropping the files in place.

If you plan to use KTX2 textures, run:

```bash
pnpm assets:setup
```

Asset compression workflows live in `docs/asset-pipeline.md`.
Asset sources are listed in `docs/asset-sources.md`.

Optional scripts:

```bash
pnpm assets:fetch
pnpm assets:fetch-nasa
pnpm assets:build-nasa
pnpm assets:convert-nasa
pnpm assets:install-ktx
pnpm assets:fetch-models      # NASA 3D Resources (ISS/Hubble/JWST/Voyager)
pnpm assets:copy-draco        # Copy local Draco decoder to public/draco for离线运行
pnpm test                     # 运行单元测试（Vitest）
```

## Celestia 数据抓取（需联网手动执行）

```bash
# 核心 data 包（stars/ssc/纹理）
powershell -ExecutionPolicy Bypass -File scripts/fetch-celestia-core.ps1

# Motherlode 常用纹理/模型
powershell -ExecutionPolicy Bypass -File scripts/fetch-motherlode.ps1

# MPC 小行星轨道
powershell -ExecutionPolicy Bypass -File scripts/fetch-mpcorb.ps1

# 批量 Horizons 向量（通过本地 /api/horizons 代理）
node scripts/fetch-horizons.mjs

# 解析 Celestia stars.dat（内置解析器，无需额外依赖）
node scripts/convert-celestia-stars.mjs
```

## Custom Models (Local)

- Upload `.glb` models from the HUD "自定义天体" panel (≤50MB).
- Models are stored in IndexedDB; metadata in `localStorage`.
- Custom targets stay local (share links won't include model binaries).

## Quality checks

- Lint: `pnpm lint` (static config ignores `public/draco/**` since it contains vendor decoders)
- Test: `pnpm test` (Vitest，覆盖轨道数学与种子随机生成)
