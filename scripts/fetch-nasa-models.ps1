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
    Invoke-WebRequest -Uri $url -OutFile $dest -Headers @{ "User-Agent" = "CosmicAtlas" }
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$modelsDir = Join-Path $root "public\assets\models"
Ensure-Dir $modelsDir

$assets = @{
  "iss.glb" = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/International%20Space%20Station%20(ISS)%20(B)/International%20Space%20Station%20(ISS)%20(B).glb"
  "hubble.glb" = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Hubble%20Space%20Telescope%20(A)/Hubble%20Space%20Telescope%20(A).glb"
  "jwst.glb" = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/James%20Webb%20Space%20Telescope%20(A)/James%20Webb%20Space%20Telescope%20(A).glb"
  "voyager.glb" = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Voyager%20Probe%20(A)/Voyager%20Probe%20(A).glb"
}

foreach ($item in $assets.GetEnumerator()) {
  $dest = Join-Path $modelsDir $item.Key
  Download-File $item.Value $dest
}

Write-Host "NASA models downloaded."
