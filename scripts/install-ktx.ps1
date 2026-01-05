param(
  [string]$Version = "4.4.2"
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ktxDir = Join-Path $root "tools\ktx"
Ensure-Dir $ktxDir

$installer = Join-Path $ktxDir "KTX-Software-$Version-Windows-x64.exe"
$uri = "https://github.com/KhronosGroup/KTX-Software/releases/download/v$Version/KTX-Software-$Version-Windows-x64.exe"

if (-not (Test-Path $installer)) {
  Write-Host "Downloading $uri"
  Invoke-WebRequest -Uri $uri -OutFile $installer
}

$installRoot = (Resolve-Path $ktxDir).Path
Write-Host "Installing to $installRoot"
Start-Process -FilePath $installer -ArgumentList "/S", "/D=$installRoot" -Wait

Write-Host "toktx path: $installRoot\bin\toktx.exe"
