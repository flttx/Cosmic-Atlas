$ErrorActionPreference = "Stop"

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$toktx = Join-Path $root "tools\ktx\bin\toktx.exe"
$texturesDir = Join-Path $root "public\assets\textures"

if (-not (Test-Path $toktx)) {
  throw "toktx not found. Run pnpm assets:install-ktx first."
}

Ensure-Dir $texturesDir

$maps = @(
  @{ base = "sun_diffuse_4k"; output = "sun_diffuse_4k.ktx2" },
  @{ base = "mercury_diffuse_4k"; output = "mercury_diffuse_4k.ktx2" },
  @{ base = "venus_diffuse_4k"; output = "venus_diffuse_4k.ktx2" },
  @{ base = "moon_diffuse_4k"; output = "moon_diffuse_4k.ktx2" },
  @{ base = "mars_diffuse_4k"; output = "mars_diffuse_4k.ktx2" },
  @{ base = "jupiter_diffuse_4k"; output = "jupiter_diffuse_4k.ktx2" },
  @{ base = "saturn_diffuse_4k"; output = "saturn_diffuse_4k.ktx2" },
  @{ base = "uranus_diffuse_4k"; output = "uranus_diffuse_4k.ktx2" },
  @{ base = "neptune_diffuse_4k"; output = "neptune_diffuse_4k.ktx2" },
  @{ base = "saturn_ring_color_4k"; output = "saturn_ring_color_4k.ktx2" }
)

foreach ($map in $maps) {
  $sourcePath = $null
  $candidateJpg = Join-Path $texturesDir ($map.base + ".jpg")
  $candidatePng = Join-Path $texturesDir ($map.base + ".png")
  if (Test-Path $candidateJpg) {
    $sourcePath = $candidateJpg
  } elseif (Test-Path $candidatePng) {
    $sourcePath = $candidatePng
  }
  $outputPath = Join-Path $texturesDir $map.output

  if (-not $sourcePath) {
    throw "Missing source texture: $($map.base).jpg/.png"
  }

  & $toktx --t2 --encode etc1s --genmipmap --resize 4096x2048 `
    $outputPath `
    $sourcePath
}

Write-Host "Converted solar system textures to KTX2."
