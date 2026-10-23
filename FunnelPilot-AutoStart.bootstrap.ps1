#requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$SourceRoot)
$ErrorActionPreference = "Stop"
# Trust only this reviewed, immutable launcher revision. It updates APP CODE
# only after that commit has passed the project's offline GitHub CI.
$pinnedCommit = "faf743a79924c7fcfc0223f07f4715c35928bdf9"
$expectedGitBlob = "416181aac1fb3ee4e5c762d619873e0cc07586e4"
$dest = Join-Path $env:LOCALAPPDATA "FunnelPilot\Launcher"
$launcher = Join-Path $dest ("start-pete-auto-release-" + $pinnedCommit + ".ps1")
$url = "https://raw.githubusercontent.com/VSCodeBot78/funnelpilot-whatsapp-app/" +
  $pinnedCommit + "/scripts/start-pete-auto-release.ps1"
try {
  if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { throw "Git fehlt." }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    Write-Host "Einmaliger Download des signierten Launcher-Stands von GitHub..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $launcher -TimeoutSec 25
  }
  $blob = (& git.exe hash-object $launcher)
  if ($LASTEXITCODE -ne 0 -or $blob.Trim().ToLowerInvariant() -ne $expectedGitBlob) {
    throw "Launcher-Pruefsumme stimmt nicht. Kein Programmstart."
  }
  & $launcher -SourceRoot $SourceRoot
} catch {
  Write-Host ("SICHERHEITS-STOP: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
