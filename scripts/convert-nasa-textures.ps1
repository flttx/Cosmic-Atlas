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

function Test-FileLocked($path) {
  try {
    $stream = [System.IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
    $stream.Close()
    return $false
  } catch {
    return $true
  }
}

function Resolve-DiffuseSource($dir) {
  $candidates = @()
  $candidates += Get-ChildItem -Path $dir -Filter "nasa_earth_diffuse_source*.*" -File -ErrorAction SilentlyContinue
  $candidates += Get-ChildItem -Path $dir -Filter "nasa_earth_diffuse_*.png" -File -ErrorAction SilentlyContinue
  $candidates += Get-ChildItem -Path $dir -Filter "nasa_earth_diffuse_*.jpg" -File -ErrorAction SilentlyContinue

  $valid = $candidates | Where-Object {
    $_.Length -gt 0 -and -not (Test-FileLocked $_.FullName)
  } | Sort-Object Length -Descending

  if ($valid.Count -gt 0) {
    return $valid[0].FullName
  }
  throw "Missing diffuse source. Run pnpm assets:fetch-nasa."
}

$diffuseSource = Resolve-DiffuseSource $texturesDir

& $toktx --t2 --encode etc1s --genmipmap --resize 4096x2048 `
  (Join-Path $texturesDir "earth_diffuse_4k.ktx2") `
  $diffuseSource

& $toktx --t2 --encode uastc --genmipmap --normal_mode --assign_oetf linear `
  (Join-Path $texturesDir "earth_normal_4k.ktx2") `
  (Join-Path $texturesDir "earth_normal_4k.png")

& $toktx --t2 --encode uastc --genmipmap --assign_oetf linear `
  (Join-Path $texturesDir "earth_roughness_4k.ktx2") `
  (Join-Path $texturesDir "earth_roughness_4k.png")

& $toktx --t2 --encode etc1s --genmipmap --resize 4096x2048 `
  (Join-Path $texturesDir "starfield_4k.ktx2") `
  (Join-Path $texturesDir "nasa_starfield.jpg")

Write-Host "Converted NASA textures to KTX2."
