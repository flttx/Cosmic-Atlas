param(
  [string]$DiffuseFile = "land_ocean_ice_2048.jpg",
  [string]$TopoFile = "world.topo.bathy.200412.3x5400x2700.jpg",
  [string]$StarfieldUrl = "https://www.nasa.gov/wp-content/uploads/2025/12/e1a-spherex-all-sky-stars-and-gas-dust.jpg",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

function Test-FileLocked($path) {
  try {
    $stream = [System.IO.File]::Open($path, 'Open', 'ReadWrite', 'None')
    $stream.Close()
    return $false
  } catch {
    return $true
  }
}

function Download-File($url, $dest, $fallbackDest) {
  $target = $dest
  if (Test-Path $dest) {
    if (Test-FileLocked $dest) {
      if ($fallbackDest) {
        Write-Host "Primary path locked. Downloading to $fallbackDest"
        $target = $fallbackDest
      } else {
        throw "Destination locked: $dest"
      }
    }
  }

  $needsDownload = $Force -or -not (Test-Path $target)

  if (-not $needsDownload) {
    $item = Get-Item $target
    if ($item.Length -eq 0) {
      $needsDownload = $true
    }
  }

  if ($needsDownload) {
    if (Test-Path $target) {
      Remove-Item -Force -ErrorAction SilentlyContinue $target
    }
    Write-Host "Downloading $url"
    Invoke-WebRequest -Uri $url -OutFile $target
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$texturesDir = Join-Path $root "public\assets\textures"
Ensure-Dir $texturesDir

$diffuseUrl = "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/$DiffuseFile"
$topoUrl = "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/$TopoFile"
$diffuseExt = [System.IO.Path]::GetExtension($DiffuseFile)
if (-not $diffuseExt) {
  $diffuseExt = ".png"
}
$diffuseDest = Join-Path $texturesDir ("nasa_earth_diffuse_source" + $diffuseExt)
$diffuseFallback = Join-Path $texturesDir ("nasa_earth_diffuse_source_alt" + $diffuseExt)

Download-File $diffuseUrl $diffuseDest $diffuseFallback
Download-File $topoUrl (Join-Path $texturesDir "nasa_earth_topo_5400.jpg")
Download-File $StarfieldUrl (Join-Path $texturesDir "nasa_starfield.jpg")

Write-Host "NASA textures downloaded."
