$ErrorActionPreference = "Stop"

Write-Host "==> Downloading Celestia 1.6.1 data (stars/ssc/textures) ..."
$baseDir = Join-Path $PSScriptRoot "..\external\celestia"
$zipPath = Join-Path $baseDir "celestia-1.6.1-data.zip"
$tarPath = Join-Path $baseDir "celestia-1.6.1.tar.gz"
$outDir = Join-Path $baseDir "data"
$tarExtractDir = Join-Path $baseDir "celestia-1.6.1"
$tarMirrors = @(
  "https://cfhcable.dl.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1.tar.gz",
  "https://phoenixnap.dl.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1.tar.gz",
  "https://pilotfiber.dl.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1.tar.gz",
  "https://downloads.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1.tar.gz"
)
$mirrors = @(
  "https://cfhcable.dl.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1-data.zip",
  "https://phoenixnap.dl.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1-data.zip",
  "https://pilotfiber.dl.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1-data.zip",
  "https://downloads.sourceforge.net/project/celestia/Celestia-source/1.6.1/celestia-1.6.1-data.zip"
)

New-Item -ItemType Directory -Force -Path $baseDir | Out-Null

function Download-File {
  param ([string[]]$Urls, [string]$Target)
  foreach ($u in $Urls) {
    Write-Host "-> Downloading $u"
    try {
      Invoke-WebRequest $u -OutFile $Target -Headers @{ "User-Agent" = "Cosmic-Atlas" } -MaximumRedirection 5
      if ((Get-Item $Target).Length -lt 1000000) {
        Write-Warning "Downloaded file too small, maybe HTML redirect. Trying next mirror..."
        Remove-Item $Target -ErrorAction SilentlyContinue
        continue
      }
      return
    }
    catch {
      Write-Warning "Failed: $u"
      Remove-Item $Target -ErrorAction SilentlyContinue
      continue
    }
  }
  throw "All mirrors failed."
}

function Extract-From-Tar {
  param (
    [string]$TarFile,
    [string]$ExtractRoot,
    [string]$DestData
  )
  if (-Not (Test-Path $TarFile)) {
    return $false
  }
  Write-Host "-> Extracting data from tar.gz (prefers full source archive)..."
  try {
    Remove-Item $DestData -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $ExtractRoot -Recurse -Force -ErrorAction SilentlyContinue
    tar -xf $TarFile -C (Split-Path $ExtractRoot)
    $dataDir = Join-Path $ExtractRoot "data"
    if (-Not (Test-Path $dataDir)) {
      throw "data directory not found in tarball"
    }
    Copy-Item -Path $dataDir -Destination $DestData -Recurse -Force
    return $true
  }
  catch {
    Write-Warning "Tar extraction failed: $_"
    return $false
  }
}

# 1) Prefer tar.gz (full source包里包含 data/)
$extracted = $false
if (-Not (Test-Path $tarPath)) {
  try {
    Download-File -Urls $tarMirrors -Target $tarPath
  }
  catch {
    Write-Warning "Tar mirrors failed, will try zip next."
  }
}
if (Test-Path $tarPath) {
  $extracted = Extract-From-Tar -TarFile $tarPath -ExtractRoot $tarExtractDir -DestData $outDir
}

# 2) Fallback: data.zip
if (-Not $extracted) {
  if (-Not (Test-Path $zipPath)) {
    Download-File -Urls $mirrors -Target $zipPath
  }
  else {
    Write-Host "-> Zip already exists, skip download"
  }

  Write-Host "-> Extracting to $outDir"
  try {
    Expand-Archive -Path $zipPath -DestinationPath $outDir -Force
    $extracted = $true
  }
  catch {
    Write-Warning "Extraction failed, deleting corrupted zip..."
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    throw
  }
}

if ($extracted) {
  Write-Host "Done. Core data in $outDir (stars.dat, ssc/, textures/)."
}
else {
  throw "Failed to obtain Celestia data (tar+zip both failed)."
}
