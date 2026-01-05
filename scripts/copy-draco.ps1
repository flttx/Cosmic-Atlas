param(
  [string]$DecoderSource,
  [string]$Output,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DecoderSource = if ($DecoderSource) { $DecoderSource } else { Join-Path $root "node_modules\\three\\examples\\jsm\\libs\\draco\\gltf" }
$Output = if ($Output) { $Output } else { Join-Path $root "public\\draco" }

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

Ensure-Dir $Output

if (-not (Test-Path $DecoderSource)) {
  Write-Error "Decoder source not found: $DecoderSource"
}

Write-Host "Copying Draco decoders from $DecoderSource to $Output"

Get-ChildItem -Path $DecoderSource -File | ForEach-Object {
  $dest = Join-Path $Output $_.Name
  if ($Force -or -not (Test-Path $dest)) {
    Copy-Item -Path $_.FullName -Destination $dest -Force
  }
}

Write-Host "Draco decoders ready at $Output"
