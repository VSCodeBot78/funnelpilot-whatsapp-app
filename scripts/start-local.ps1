#requires -Version 5.1
<#
Funnel Pilot: safe local Windows test launcher (no Meta outbound, no public tunnel).
From repository root:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
Validation only (build/tests, no running HTTP preflight):
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -CheckOnly
#>
param([switch]$CheckOnly)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backend = Join-Path $repo "backend"
$dashboard = Join-Path $repo "dashboard"

function Invoke-Checked([string]$Title, [string]$Executable, [string[]]$Arguments) {
  Write-Host ("[Funnel Pilot] " + $Title) -ForegroundColor Cyan
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Title fehlgeschlagen (Exitcode $LASTEXITCODE). Keine Server gestartet."
  }
}

function Start-PowerShellWindow([string]$Title, [string]$Command) {
  $full = '$Host.UI.RawUI.WindowTitle = "' + $Title + '"' + [Environment]::NewLine + $Command
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($full))
  Start-Process -FilePath "powershell.exe" -ArgumentList "-NoLogo -NoProfile -NoExit -EncodedCommand $encoded" -WorkingDirectory $repo | Out-Null
}

Write-Host "==== Funnel Pilot: sicherer Laptop-Test ====" -ForegroundColor Green
Write-Host "Projekt: $repo"
Write-Host "Keine Live-Sends, kein Cloudflare-Tunnel, keine neuen Serverressourcen." -ForegroundColor Yellow

foreach ($name in @("git.exe", "node.exe", "npm.cmd")) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name fehlt. Bitte Git und Node.js 20+ installieren."
  }
}
$majorText = & node.exe -p "process.versions.node.split('.')[0]"
if ($LASTEXITCODE -ne 0 -or [int]$majorText -lt 20) {
  throw "Node.js 20 oder neuer ist erforderlich."
}

$currentBranch = (& git.exe -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "Git-Branch konnte nicht gelesen werden." }
if ($currentBranch -ne "funnel-pilot-current") {
  throw "Aktueller Branch: '$currentBranch'. Bitte zuerst 'git switch funnel-pilot-current' und 'git pull --ff-only' ausführen."
}
$localChanges = & git.exe -C $repo status --porcelain
if ($localChanges) {
  Write-Warning "Lokale Änderungen gefunden. Kein automatischer Git-Pull, Checkout oder Reset."
}

$envPath = Join-Path $backend ".env"
if (-not (Test-Path -LiteralPath $envPath)) {
  $examplePath = Join-Path $backend ".env.example"
  if (-not (Test-Path -LiteralPath $examplePath)) { throw "backend/.env.example fehlt." }
  Copy-Item -LiteralPath $examplePath -Destination $envPath
  Write-Warning "backend/.env aus Beispiel erzeugt. Die Platzhalter sind KEINE gültigen Anbieter-Zugangsdaten."
}
if (-not (Test-Path -LiteralPath (Join-Path $backend "node_modules"))) {
  Invoke-Checked "Backend-Abhängigkeiten installieren" "npm.cmd" @("--prefix", $backend, "ci")
}
if (-not (Test-Path -LiteralPath (Join-Path $dashboard "node_modules"))) {
  Invoke-Checked "Dashboard-Abhängigkeiten installieren" "npm.cmd" @("--prefix", $dashboard, "ci")
}
Invoke-Checked "Backend: Build und Tests" "npm.cmd" @("--prefix", $backend, "run", "check")
Invoke-Checked "Dashboard: Build und Tests" "npm.cmd" @("--prefix", $dashboard, "run", "build")
Write-Host "Alle automatisierten Tests erfolgreich." -ForegroundColor Green
if ($CheckOnly) {
  Write-Host "CheckOnly: Keine Server gestartet."
  exit 0
}

# Refuse an existing service on any test port. It could run with unsafe old flags.
foreach ($port in @(3001, 5173, 3002)) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connect = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    try {
      if ($connect.AsyncWaitHandle.WaitOne(250)) {
        try {
          $client.EndConnect($connect)
          throw "Port $port ist bereits belegt. Alte Testprozesse schliessen und erneut starten."
        } catch [System.Net.Sockets.SocketException] { }
      }
    } finally {
      $connect.AsyncWaitHandle.Close()
    }
  } finally {
    $client.Close()
  }
}

$escapedBackend = $backend.Replace("'", "''")
$escapedDashboard = $dashboard.Replace("'", "''")
$escapedRepo = $repo.Replace("'", "''")

$backendCommands = @(
  "Set-Location -LiteralPath '$escapedBackend'",
  '$env:NODE_ENV = "development"',
  '$env:FUNNELPILOT_LOCAL_TEST_MODE = "true"',
  '$env:CORS_ORIGIN = "http://127.0.0.1:5173"',
  '$env:PORT = "3001"',
  '$env:INSTAGRAM_ENGINE_ENABLED = "false"',
  '$env:INSTAGRAM_SEND_ENABLED = "false"',
  '$env:INSTAGRAM_ALLOWED_SENDER_IDS = ""',
  '$env:INSTAGRAM_ALLOW_ALL_SENDERS = "false"',
  '$env:INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false"',
  '$env:WHATSAPP_SEND_ENABLED = "false"',
  '$env:ENABLE_GENERIC_WEBHOOKS = "false"',
  '$env:DISABLE_DESTRUCTIVE_ROUTES = "true"',
  'npm.cmd run dev'
) -join [Environment]::NewLine

$dashboardCommands = @(
  "Set-Location -LiteralPath '$escapedDashboard'",
  'npm.cmd run dev -- --host 127.0.0.1'
) -join [Environment]::NewLine

$relayCommands = @(
  "Set-Location -LiteralPath '$escapedRepo'",
  '$env:LOCAL_ALLOW_CALENDLY_WEBHOOK = "false"',
  'node.exe .\scripts\local-webhook-relay.mjs'
) -join [Environment]::NewLine

Start-PowerShellWindow "Funnel Pilot Backend - Sends AUS" $backendCommands
Start-PowerShellWindow "Funnel Pilot Dashboard" $dashboardCommands
Start-PowerShellWindow "Funnel Pilot Webhook Relay (lokal)" $relayCommands

$dashboardUrl = "http://127.0.0.1:5173"
$backendReady = $false
$dashboardReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:3001/health/readiness" -UseBasicParsing -TimeoutSec 2
    if ($health.StatusCode -eq 200) {
      $readiness = $health.Content | ConvertFrom-Json
      $backendReady = $true
      if ($readiness.instagramSendEnabled -ne $false -or $readiness.whatsappSendEnabled -ne $false -or $readiness.instagramEngineEnabled -ne $false) {
        throw "UNSICHERER STATUS: Ein Sende-Flag ist aktiv."
      }
    }
  } catch {
    if ($_.Exception.Message -like "*UNSICHERER STATUS*") { throw }
  }
  try {
    $page = Invoke-WebRequest -Uri $dashboardUrl -UseBasicParsing -TimeoutSec 2
    $dashboardReady = ($page.StatusCode -eq 200)
  } catch { }
  if ($backendReady -and $dashboardReady) { break }
}
if (-not $backendReady -or -not $dashboardReady) {
  throw "Backend oder Dashboard nicht bereit. Bitte die PowerShell-Fenster prüfen."
}

# Phase 32: do not open the browser until the webhook relay actually listens
# AND a real localhost HTTP preflight has rejected every admin/public route.
$relayReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connection = $client.BeginConnect("127.0.0.1", 3002, $null, $null)
    try {
      if ($connection.AsyncWaitHandle.WaitOne(250)) {
        try {
          $client.EndConnect($connection)
          $relayReady = $true
        } catch [System.Net.Sockets.SocketException] { }
      }
    } finally {
      $connection.AsyncWaitHandle.Close()
    }
  } finally {
    $client.Close()
  }
  if ($relayReady) { break }
  Start-Sleep -Seconds 1
}
if (-not $relayReady) {
  throw "Webhook-Relay Port 3002 nicht bereit. Kein Browserstart. PowerShell-Fenster pruefen."
}
try {
  Invoke-Checked "Lokaler Sicherheits-Preflight (echte HTTP-Sperrpruefung)" "node.exe" @(
    (Join-Path $repo "scripts\local-safety-preflight.mjs")
  )
} catch {
  Write-Host "SICHERHEITS-STOP: Die drei gestarteten PowerShell-Fenster schliessen. Keinen Tunnel starten." -ForegroundColor Red
  throw
}

Write-Host "Backend/Dashboard erreichbar, Relay pro Callback gesichert, Instagram und WhatsApp deaktiviert." -ForegroundColor Green
Write-Host "Test im Browser: $dashboardUrl" -ForegroundColor Green
Write-Host "Cloudflare wurde NICHT gestartet." -ForegroundColor Yellow
Start-Process $dashboardUrl | Out-Null
