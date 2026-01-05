$ErrorActionPreference = "Stop"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "==> Downloading MPCORB (small-body orbital elements) ..."
$mirrors = @(
  "https://www.minorplanetcenter.net/Extended_Files/mpcorb_extended.dat.gz",
  "https://www.minorplanetcenter.net/Extended_Files/MPCORB.DAT.gz",
  "https://minorplanetcenter.net/Extended_Files/MPCORB.DAT.gz"
)
$outDir = Join-Path $PSScriptRoot "..\external\mpc"
$gzPath = Join-Path $outDir "MPCORB.DAT.gz"
$datPath = Join-Path $outDir "MPCORB.DAT"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Download-File {
  param ([string[]]$Urls, [string]$Target)
  foreach ($u in $Urls) {
    Write-Host "-> $u"
    try {
      Invoke-WebRequest $u -OutFile $Target -Headers @{ "User-Agent" = "Cosmic-Atlas" }
      return $true
    }
    catch {
      Write-Warning "Failed: $u"
      Remove-Item $Target -ErrorAction SilentlyContinue
    }
  }
  return $false
}

$ok = Download-File -Urls $mirrors -Target $gzPath
if (-not $ok) {
  throw "All mirrors failed."
}

Write-Host "-> Extracting"
if (Test-Path $datPath) { Remove-Item $datPath -Force }

try {
  $inStream = [System.IO.File]::OpenRead($gzPath)
  $outStream = [System.IO.File]::Create($datPath)
  $gzipStream = New-Object System.IO.Compression.GzipStream($inStream, [System.IO.Compression.CompressionMode]::Decompress)
  $gzipStream.CopyTo($outStream)
  $gzipStream.Dispose()
  $inStream.Dispose()
  $outStream.Dispose()
}
catch {
  Write-Warning "Extraction failed: $_"
  throw
}

Write-Host "Done. Raw file at $datPath"
