param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

function Download-File($url, $dest) {
  if ($Force -or -not (Test-Path $dest)) {
    Write-Host "Downloading $url"
    $userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    $referer = "https://www.solarsystemscope.com/"
    & curl.exe -L -A $userAgent -e $referer -o $dest $url
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$texturesDir = Join-Path $root "public\assets\textures"
Ensure-Dir $texturesDir

$base = "https://www.solarsystemscope.com/textures/download/4k"
$assets = @{
  "sun_diffuse_4k.jpg" = "$base/sunmap4k.jpg"
  "mercury_diffuse_4k.jpg" = "$base/mercurymap4k.jpg"
  "venus_diffuse_4k.jpg" = "$base/venusmap4k.jpg"
  "moon_diffuse_4k.jpg" = "$base/moonmap4k.jpg"
  "mars_diffuse_4k.jpg" = "$base/marsmap4k.jpg"
  "jupiter_diffuse_4k.jpg" = "$base/jupitermap4k.jpg"
  "saturn_diffuse_4k.jpg" = "$base/saturnmap4k.jpg"
  "uranus_diffuse_4k.jpg" = "$base/uranusmap4k.jpg"
  "neptune_diffuse_4k.jpg" = "$base/neptunemap4k.jpg"
  "saturn_ring_color_4k.jpg" = "$base/saturnringcolor.jpg"
}

foreach ($item in $assets.GetEnumerator()) {
  $dest = Join-Path $texturesDir $item.Key
  Download-File $item.Value $dest
}

Write-Host "Solar system textures downloaded."
