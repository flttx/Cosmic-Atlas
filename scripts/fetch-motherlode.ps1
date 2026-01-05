$ErrorActionPreference = "Stop"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } # Motherlode 站点证书常年异常，强制忽略

Write-Host "==> Downloading selected assets from Celestia Motherlode ..."
$bases = @(
  "https://celestiamotherlode.net/catalog",
  "http://celestiamotherlode.net/catalog",  # fallback for legacy certs
  "https://web.archive.org/web/20220701000000/http://www.celestiamotherlode.net/catalog" # Wayback fallback
)

# Custom mirror override: set CELESTIA_MOTHERLODE_BASE to one or more ';'-separated base URLs
if ($env:CELESTIA_MOTHERLODE_BASE) {
  $bases = $env:CELESTIA_MOTHERLODE_BASE.Split(";") + $bases
  Write-Host "Using custom mirror(s): $($env:CELESTIA_MOTHERLODE_BASE)"
}

$localTextureRoot = Join-Path $PSScriptRoot "..\external\celestia\celestia-1.6.1\textures\medres"
$localLoresRoot = Join-Path $PSScriptRoot "..\external\celestia\celestia-1.6.1\textures\lores"
$localModelRoot = Join-Path $PSScriptRoot "..\external\celestia\celestia-1.6.1\models"
$localFallbackMap = @{
  "earth.dds"        = Join-Path $localTextureRoot "earth.png"
  "mars.dds"         = Join-Path $localTextureRoot "mars.jpg"
  "jupiter.dds"      = Join-Path $localTextureRoot "jupiter.jpg"
  "saturn.dds"       = Join-Path $localTextureRoot "saturn.jpg"
  "uranus.dds"       = Join-Path $localTextureRoot "uranus.jpg"
  "neptune.dds"      = Join-Path $localTextureRoot "neptune.jpg"
  "mercury.dds"      = Join-Path $localTextureRoot "mercury.jpg"
  "venus.dds"        = Join-Path $localTextureRoot "venus.jpg"
  "moon.dds"         = Join-Path $localTextureRoot "moon.jpg"
  "sun.jpg"          = Join-Path $PSScriptRoot "..\external\celestia\celestia-1.6.1\textures\flare.jpg"
  "asteroidbelt.png" = Join-Path $localTextureRoot "asteroid.jpg"
  "iss.cmod"         = Join-Path $localModelRoot "apollo.cmod"       # placeholder
  "hubble.cmod"      = Join-Path $localModelRoot "apollo.cmod"       # placeholder
  "voyager.cmod"     = Join-Path $localModelRoot "gaspra.cmod"       # placeholder
}
$targets = @(
  "/textures/medres/earth.dds",
  "/textures/medres/mars.dds",
  "/textures/medres/jupiter.dds",
  "/textures/medres/saturn.dds",
  "/textures/medres/uranus.dds",
  "/textures/medres/neptune.dds",
  "/textures/medres/mercury.dds",
  "/textures/medres/venus.dds",
  "/textures/medres/moon.dds",
  "/textures/lores/sun.jpg",
  "/textures/medres/asteroidbelt.png",
  "/models/spacecraft/iss/iss.cmod",
  "/models/spacecraft/hubble/hubble.cmod",
  "/models/spacecraft/voyager/voyager.cmod"
)

$failed = @()

foreach ($t in $targets) {
  $dst = Join-Path $PSScriptRoot ("..\external\motherlode" + $t)
  $dstDir = Split-Path $dst -Parent
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  if (Test-Path $dst) {
    Write-Host "Skip (exists): $t"
    continue
  }
  Write-Host "-> $t"

  $success = $false
  foreach ($base in $bases) {
    $url = "$base$t"
    try {
      Invoke-WebRequest $url -OutFile $dst -TimeoutSec 8
      $success = $true
      break
    }
    catch {
      Write-Warning "Failed: $url"
      Remove-Item $dst -ErrorAction SilentlyContinue
    }
  }

  if (-not $success) {
    # Local fallback from Celestia 1.6.1 source tree (if present)
    $fname = Split-Path $t -Leaf
    if ($localFallbackMap.ContainsKey($fname) -and (Test-Path $localFallbackMap[$fname])) {
      Copy-Item $localFallbackMap[$fname] $dst -Force
      Write-Warning "Used local fallback for $t -> $fname"
      continue
    }

    Write-Warning "Download failed for $t (all bases)"
    $failed += $t
  }
}

Write-Host "Done. Assets saved under external/motherlode"
if ($failed.Count -gt 0) {
  Write-Warning "Failed items: $($failed -join ', ')"
}
