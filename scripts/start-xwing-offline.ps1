#requires -Version 5.1
# Funnel Pilot X-Wing: offline backend + dashboard in the detached desktop test worktree.
# No Meta/WhatsApp sends, OAuth, AI calls, payments or public webhook relay.
# Keep the old dashboard-only shortcut untouched.
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backend = Join-Path $repo "backend"
$dashboard = Join-Path $repo "dashboard"
$dataDir = Join-Path $backend "data\xwing-offline"

function Assert-Tool([string]$Executable) {
  if (-not (Get-Command $Executable -ErrorAction SilentlyContinue)) {
    throw "$Executable fehlt. Bitte nach Anleitung lokal einrichten."
  }
}

function Test-LocalPortFree([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $attempt = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    try {
      if ($attempt.AsyncWaitHandle.WaitOne(300)) {
        try {
          $client.EndConnect($attempt)
          throw "Port $Port ist bereits belegt. Bestehende Server nicht ersetzen: Fenster schliessen."
        } catch [System.Net.Sockets.SocketException] { }
      }
    } finally {
      $attempt.AsyncWaitHandle.Close()
    }
  } finally {
    $client.Close()
  }
}

function Start-TestWindow([string]$Title, [string]$Command) {
  $script = '$Host.UI.RawUI.WindowTitle = "' + $Title + '"' +
    [Environment]::NewLine + $Command
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoLogo", "-NoProfile", "-NoExit", "-EncodedCommand", $encoded
  ) -WorkingDirectory $repo | Out-Null
}

Write-Host "==== Funnel Pilot: X-Wing sicherer Desktop-Test ====" -ForegroundColor Cyan
Write-Host "Nur getrennte lokale Testdaten. Keine echten Anbieter-Verbindungen." -ForegroundColor Yellow

if ((Split-Path -Path $repo -Leaf) -ne "FunnelPilot-Desktop-Test") {
  throw "SICHERHEITS-STOP: Nur im Ordner FunnelPilot-Desktop-Test erlaubt."
}
foreach ($tool in @("git.exe", "node.exe", "npm.cmd")) { Assert-Tool $tool }
$inside = (& git.exe -C $repo rev-parse --is-inside-work-tree).Trim()
if ($LASTEXITCODE -ne 0 -or $inside -ne "true") {
  throw "SICHERHEITS-STOP: Kein Git-Testworktree."
}
$branch = ([string](& git.exe -C $repo branch --show-current)).Trim()
if ($LASTEXITCODE -ne 0 -or $branch) {
  throw "SICHERHEITS-STOP: Der Testordner muss als detached HEAD laufen."
}
$nodeMajor = & node.exe -p "Number(process.versions.node.split('.')[0])"
if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 20) {
  throw "Node.js 20 oder neuer ist erforderlich."
}
if (-not (Test-Path -LiteralPath (Join-Path $dashboard "node_modules\vite\bin\vite.js"))) {
  throw "Dashboard-Pakete fehlen. Einmalig im dashboard-Ordner 'npm ci' ausfuehren."
}
if (-not (Test-Path -LiteralPath (Join-Path $backend "node_modules\.bin\tsx.cmd"))) {
  throw "Backend-Pakete fehlen. Einmalig im backend-Ordner 'npm ci' ausfuehren."
}
foreach ($port in @(3001, 5173)) { Test-LocalPortFree $port }

# Never read or reuse active test/production data. This path is already gitignored.
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$escapedBackend = $backend.Replace("'", "''")
$escapedDashboard = $dashboard.Replace("'", "''")
$escapedDataDir = $dataDir.Replace("'", "''")

# Explicit overrides protect against process-env and dotenv values.
# WinPS 5.1 deletes variables assigned an empty string, therefore use " ".
$securityFlags = @(
  '$env:NODE_ENV = "development"',
  '$env:FUNNELPILOT_LOCAL_TEST_MODE = "true"',
  '$env:CORS_ORIGIN = "http://127.0.0.1:5173"',
  '$env:PORT = "3001"',
  '$env:INSTAGRAM_ENGINE_ENABLED = "false"',
  '$env:INSTAGRAM_SEND_ENABLED = "false"',
  '$env:WHATSAPP_SEND_ENABLED = "false"',
  '$env:INSTAGRAM_ALLOW_ALL_SENDERS = "false"',
  '$env:INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false"',
  '$env:WHATSAPP_ALLOW_ALL_RECIPIENTS = "false"',
  '$env:INSTAGRAM_ALLOWED_SENDER_IDS = " "',
  '$env:WHATSAPP_ALLOWED_RECIPIENT_IDS = " "',
  '$env:ENABLE_GENERIC_WEBHOOKS = "false"',
  '$env:DISABLE_DESTRUCTIVE_ROUTES = "true"',
  '$env:LOCAL_ALLOW_CALENDLY_WEBHOOK = "false"',
  '$env:CALENDLY_WEBHOOK_VERIFY_MODE = "off"'
)
$externalCredentials = @(
  "OPENAI_API_KEY", "META_ACCESS_TOKEN", "WHATSAPP_ACCESS_TOKEN",
  "META_APP_SECRET", "META_VERIFY_TOKEN", "META_PHONE_NUMBER_ID",
  "META_WABA_ID", "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_APP_SECRET",
  "INSTAGRAM_VERIFY_TOKEN", "INSTAGRAM_ACCOUNT_ID",
  "CALENDLY_PAT", "CALENDLY_WEBHOOK_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET",
  "CALENDLY_OAUTH_CLIENT_ID", "CALENDLY_OAUTH_CLIENT_SECRET",
  "HUBSPOT_OAUTH_CLIENT_ID", "HUBSPOT_OAUTH_CLIENT_SECRET",
  "OAUTH_TOKEN_ENCRYPTION_KEY", "PUBLIC_BACKEND_URL", "WEBHOOK_BASE_URL",
  "PUBLIC_DASHBOARD_URL"
)
foreach ($name in $externalCredentials) {
  $securityFlags += '$env:' + $name + ' = " "'
}
$backendCommand = @(
  "Set-Location -LiteralPath '$escapedBackend'"
) + $securityFlags + @(
  '$env:DATA_DIR = ' + "'$escapedDataDir'",
  'npm.cmd run dev'
)
$dashboardCommand = @(
  "Set-Location -LiteralPath '$escapedDashboard'",
  'npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort'
)

Write-Host "Backend und Dashboard starten nur auf 127.0.0.1..." -ForegroundColor Cyan
Start-TestWindow "Funnel Pilot X-Wing Backend - KEINE SENDS" ($backendCommand -join [Environment]::NewLine)
Start-TestWindow "Funnel Pilot X-Wing Dashboard" ($dashboardCommand -join [Environment]::NewLine)

# No browser, no API action unless both ports report a known, safe local service.
$preflight = Join-Path $PSScriptRoot "xwing-offline-preflight.mjs"
$ready = $false
for ($attempt = 0; $attempt -lt 25; $attempt++) {
  Start-Sleep -Seconds 1
  # cmd redirects native stderr without a WinPS 5.1 NativeCommandError while services start.
  & cmd.exe /d /c "node.exe `"$preflight`" >NUL 2>&1"
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
}
if (-not $ready) {
  throw "SICHERHEITS-STOP: Lokaler X-Wing-Preflight fehlgeschlagen. Beide neuen Serverfenster schliessen. Kein Browserstart."
}
Write-Host "X-WING OFFLINE BEREIT. Kein Meta-Send, keine externe KI." -ForegroundColor Green
Start-Process "http://127.0.0.1:5173/" | Out-Null
Write-Host "Backend- und Dashboard-Fenster waehrend des Tests offen lassen."
