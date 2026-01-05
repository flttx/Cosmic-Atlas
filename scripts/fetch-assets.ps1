param(
  [string]$TextureId = "moon_01",
  [string]$HdriId = "moonless_golf",
  [string[]]$ModelIds = @("moon_rock_01", "moon_rock_02")
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

function Download-File($url, $dest) {
  if (-not (Test-Path $dest)) {
    Write-Host "Downloading $url"
    Invoke-WebRequest -Uri $url -OutFile $dest
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$texturesDir = Join-Path $root "public\assets\textures"
$hdriDir = Join-Path $root "public\assets\hdri"
$modelsDir = Join-Path $root "public\assets\models"

Ensure-Dir $texturesDir
Ensure-Dir $hdriDir
Ensure-Dir $modelsDir

# Textures (4k)
$textureFiles = Invoke-RestMethod "https://api.polyhaven.com/files/$TextureId"
$diffUrl = $textureFiles.Diffuse."4k".jpg.url
$roughUrl = $textureFiles.Rough."4k".jpg.url
$normalUrl = $textureFiles.nor_gl."4k".jpg.url

Download-File $diffUrl (Join-Path $texturesDir "${TextureId}_diff_4k.jpg")
Download-File $roughUrl (Join-Path $texturesDir "${TextureId}_rough_4k.jpg")
Download-File $normalUrl (Join-Path $texturesDir "${TextureId}_nor_gl_4k.jpg")

# HDRI (4k HDR + tonemapped JPG)
$hdriFiles = Invoke-RestMethod "https://api.polyhaven.com/files/$HdriId"
$hdriUrl = $hdriFiles.hdri."4k".hdr.url
$tonemappedUrl = $hdriFiles.tonemapped.url

Download-File $hdriUrl (Join-Path $hdriDir "${HdriId}_4k.hdr")
Download-File $tonemappedUrl (Join-Path $texturesDir "${HdriId}_tonemapped.jpg")

# Models (4k glTF + textures)
foreach ($id in $ModelIds) {
  $modelFiles = Invoke-RestMethod "https://api.polyhaven.com/files/$id"
  $gltfUrl = $modelFiles.gltf."4k".gltf.url
  $include = $modelFiles.gltf."4k".gltf.include
  $modelDir = Join-Path $modelsDir $id
  Ensure-Dir $modelDir

  Download-File $gltfUrl (Join-Path $modelDir "${id}_4k.gltf")

  foreach ($entry in $include.PSObject.Properties) {
    $relative = $entry.Name
    $url = $entry.Value.url
    $destPath = Join-Path $modelDir $relative
    Ensure-Dir (Split-Path $destPath -Parent)
    Download-File $url $destPath
  }
}

Write-Host "Done."
