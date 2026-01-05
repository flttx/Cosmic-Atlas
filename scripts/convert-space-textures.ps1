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

$patterns = @(
  "zodiac_nebula_*.jpg",
  "zodiac_nebula_*.jpeg",
  "zodiac_nebula_*.png",
  "halley_comet*.jpg",
  "halley_comet*.jpeg",
  "halley_comet*.png",
  "iss*.jpg",
  "iss*.jpeg",
  "iss*.png",
  "hubble*.jpg",
  "hubble*.jpeg",
  "hubble*.png"
)

$sources = @()
foreach ($pattern in $patterns) {
  $sources += Get-ChildItem -Path $texturesDir -Filter $pattern -File -ErrorAction SilentlyContinue
}

if ($sources.Count -eq 0) {
  throw "No NASA gallery sources found. Run pnpm assets:fetch-gallery first."
}

foreach ($source in $sources) {
  $outputName = "$($source.BaseName).ktx2"
  $outputPath = Join-Path $texturesDir $outputName

  & $toktx --t2 --encode etc1s --genmipmap --resize 4096x4096 `
    $outputPath `
    $source.FullName
}

Write-Host "Converted NASA gallery textures to KTX2."
