#requires -Version 5.1
# Stable owner launcher. Only stages a CI-green snapshot in a NEW git worktree.
# No writes to tracked source files, no resets, no merges or real Meta sends.
param([Parameter(Mandatory=$true)][string]$SourceRoot)
$ErrorActionPreference = "Stop"
$branch = "refs/heads/feat/pete-policy-v4-20261022"
$remoteExpected = "VSCodeBot78/funnelpilot-whatsapp-app"
$releasesDir = Join-Path $env:LOCALAPPDATA "FunnelPilot\Releases"
$dataDir = Join-Path $env:LOCALAPPDATA "FunnelPilot\PeteLab\Data"
$readyFile = Join-Path $env:LOCALAPPDATA "FunnelPilot\PeteLab\last-ready-sha.txt"
$windowTitle = "Funnel Pilot | AutoStart"
function Stop-Safe([string]$why) { throw ("SICHERHEITS-STOP: " + $why) }
function Run-Git([string[]]$arguments) {
  $result = & git.exe @arguments 2>&1
  if ($LASTEXITCODE -ne 0) { Stop-Safe ("Git: " + ($result -join " ").Substring(0, [Math]::Min(250, ($result -join " ").Length))) }
  return @($result)
}
function Is-Port-Free([int]$port) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
  try { $listener.Start(); return $true } catch { return $false } finally { try { $listener.Stop() } catch {} }
}
function Assert-ReadySnapshot([string]$sha) {
  return ($sha -match '^[a-f0-9]{40}$' -and
    (Test-Path -LiteralPath (Join-Path $releasesDir $sha) -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path (Join-Path $releasesDir $sha) "backend\node_modules\.bin\tsx.cmd")) -and
    (Test-Path -LiteralPath (Join-Path (Join-Path $releasesDir $sha) "dashboard\node_modules\vite\bin\vite.js")))
}
function Start-LocalService([string]$title, [string]$working, [string[]]$commands) {
  $body = '$Host.UI.RawUI.WindowTitle = "' + $title + '"' + [Environment]::NewLine
  $body += 'Set-Location -LiteralPath ' + "'" + $working.Replace("'","''") + "'" + [Environment]::NewLine
  $body += ($commands -join [Environment]::NewLine)
  $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($body))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoLogo","-NoProfile","-NoExit","-EncodedCommand",$encoded) -WorkingDirectory $working | Out-Null
}
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " FUNNEL PILOT | EIN KLICK: UPDATE UND LOKALER TEST" -ForegroundColor Cyan
Write-Host " Nur Testordner. Alte lokale Arbeit bleibt unangetastet." -ForegroundColor Yellow
Write-Host " KI-Kosten und Meta-/WhatsApp-Versand bleiben AUS." -ForegroundColor Yellow
Write-Host "========================================================="
foreach ($tool in @("git.exe","node.exe","npm.cmd")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Stop-Safe ($tool + " fehlt.") }
}
$source = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd([char[]]@('\','/'))
if ((Split-Path $source -Leaf) -ne "FunnelPilot-Desktop-Test") {
  Stop-Safe "Die Startdatei muss im vorhandenen FunnelPilot-Desktop-Test-Ordner liegen."
}
if (-not (Test-Path -LiteralPath (Join-Path $source "backend\package.json"))) {
  Stop-Safe "Die Backend-Dateien wurden am Startort nicht gefunden."
}
$inside = (Run-Git @("-C",$source,"rev-parse","--is-inside-work-tree") | Select-Object -First 1)
if ($inside -ne "true") { Stop-Safe "Startordner ist kein Git-Testordner." }
$prefix = @(Run-Git @("-C",$source,"rev-parse","--show-prefix")) -join ""
if ($prefix.Trim()) { Stop-Safe "Startdatei liegt nicht im Git-Stammordner." }
$origin = @(Run-Git @("-C",$source,"remote","get-url","origin")) -join ""
$origin = $origin.Trim()
if ($origin -notmatch '^https://github\.com/VSCodeBot78/funnelpilot-whatsapp-app(?:\.git)?/?$' -and
    $origin -notmatch '^git@github\.com:VSCodeBot78/funnelpilot-whatsapp-app(?:\.git)?$') {
  Stop-Safe "Git origin ist nicht das erwartete Funnel-Pilot-Projekt."
}
$nodeMajor = & node.exe -p "Number(process.versions.node.split('.')[0])"
if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 20) { Stop-Safe "Node.js 20+ erforderlich." }
if (-not (Is-Port-Free 3001) -or -not (Is-Port-Free 5173)) {
  Stop-Safe "Alte Backend-/Dashboardfenster zuerst schliessen (Port 3001/5173 belegt)."
}
New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
$targetSha = ""
try {
  Write-Host "Pruefe aktuelle GitHub-Version und gruene Offline-Tests..." -ForegroundColor Cyan
  # This only READS the remote ref; it does not update the original worktree.
  $tip = @(Run-Git @("-C",$source,"ls-remote","origin",$branch))
  if ($tip.Count -ne 1) { Stop-Safe "Testzweig auf GitHub nicht gefunden." }
  $sha = ($tip[0] -split '\s+')[0].ToLowerInvariant()
  if ($sha -notmatch '^[a-f0-9]{40}$') { Stop-Safe "Ungueltige GitHub-Version." }
  $api = "https://api.github.com/repos/" + $remoteExpected +
    "/actions/workflows/pete-desktop-quality-qa.yml/runs?head_sha=" + $sha + "&per_page=20"
  $results = Invoke-RestMethod -Uri $api -Headers @{ "User-Agent" = "FunnelPilot-OwnerAutoStart" ; "Accept"="application/vnd.github+json" } -TimeoutSec 20
  $valid = @($results.workflow_runs | Where-Object {
    $_.head_sha -eq $sha -and $_.status -eq "completed" -and $_.conclusion -eq "success"
  })
  if ($valid.Count -ne 1 -and $valid.Count -lt 1) {
    Stop-Safe "Aktuellster Commit ist noch nicht vollstaendig im kostenlosen QA-Lauf bestanden."
  }
  Write-Host ("Freigegebene QA-Version: " + $sha.Substring(0,8)) -ForegroundColor Green
  $candidate = Join-Path $releasesDir $sha
  if (-not (Assert-ReadySnapshot $sha)) {
    if (Test-Path -LiteralPath $candidate) {
      Stop-Safe "Unvollstaendiger Updateordner vorhanden. Keine automatische Ueberschreibung."
    }
    # A dirty source worktree is ACCEPTED. Git writes the clean snapshot elsewhere.
    Write-Host "Neue Version in separatem Ordner einrichten..." -ForegroundColor Cyan
    $fetched = @(Run-Git @("-C",$source,"fetch","--no-tags","origin",$branch))
    $fetchedSha = @(Run-Git @("-C",$source,"rev-parse","FETCH_HEAD")) -join ""
    if ($fetchedSha.Trim() -ne $sha) { Stop-Safe "GitHub-Version hat sich waehrend des Updates geaendert." }
    $created = @(Run-Git @("-C",$source,"worktree","add","--detach",$candidate,$sha))
    $releaseSha = @(Run-Git @("-C",$candidate,"rev-parse","HEAD")) -join ""
    if ($releaseSha.Trim() -ne $sha) { Stop-Safe "Release-SHA stimmt nicht." }
    $sourceEnv = Join-Path $source "backend\.env"
    if (Test-Path -LiteralPath $sourceEnv -PathType Leaf) {
      # Private local copy, never uploaded or printed. New data is always isolated.
      Copy-Item -LiteralPath $sourceEnv -Destination (Join-Path $candidate "backend\.env") -ErrorAction Stop
    }
    & npm.cmd --prefix (Join-Path $candidate "backend") ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Stop-Safe "Backend-Paketinstallation fehlgeschlagen." }
    & npm.cmd --prefix (Join-Path $candidate "dashboard") ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Stop-Safe "Dashboard-Paketinstallation fehlgeschlagen." }
    & npm.cmd --prefix (Join-Path $candidate "backend") run build
    if ($LASTEXITCODE -ne 0) { Stop-Safe "Backend-Build fehlgeschlagen." }
    & npm.cmd --prefix (Join-Path $candidate "dashboard") run build
    if ($LASTEXITCODE -ne 0) { Stop-Safe "Dashboard-Build fehlgeschlagen." }
  }
  if (-not (Assert-ReadySnapshot $sha)) { Stop-Safe "Releaseverzeichnis nicht startfaehig." }
  $targetSha = $sha
} catch {
  Write-Host ("Update nicht moeglich: " + $_.Exception.Message) -ForegroundColor Yellow
  # Only fall back to a PREVIOUSLY ready, persistent release. Never start a broken update.
  if (Test-Path -LiteralPath $readyFile) {
    $oldSha = (Get-Content -LiteralPath $readyFile -Raw).Trim()
    if (Assert-ReadySnapshot $oldSha) {
      $targetSha = $oldSha
      Write-Host ("Nutze letzte vorbereitete Version: " + $oldSha.Substring(0,8)) -ForegroundColor Yellow
    }
  }
}
if (-not $targetSha) { Stop-Safe "Keine gepruefte Releaseversion verfuegbar. Die alte Installation bleibt erhalten." }
$runtime = Join-Path $releasesDir $targetSha
$backend = Join-Path $runtime "backend"
$dashboard = Join-Path $runtime "dashboard"
# Do not copy old leads, spend ledgers or OAuth sessions. This directory persists
# across future releases. Original local data remains unchanged.
$protected = @(
  '$env:NODE_ENV = "development"',
  '$env:FUNNELPILOT_LOCAL_TEST_MODE = "true"',
  '$env:PORT = "3001"',
  '$env:CORS_ORIGIN = "http://127.0.0.1:5173"',
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
  '$env:CALENDLY_WEBHOOK_VERIFY_MODE = "off"',
  '$env:PETE_LLM_API_CALLS_APPROVED = "false"'
)
$dataLine = '$env:DATA_DIR = ' + "'" + $dataDir.Replace("'","''") + "'"
Start-LocalService "Funnel Pilot Backend | Safe Mode" $backend ($protected + @($dataLine,"npm.cmd run dev"))
Start-LocalService "Funnel Pilot Dashboard | AutoStart" $dashboard @("npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort")
$ready = $false
for ($n=0; $n -lt 25; $n++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:3001/health/readiness" -TimeoutSec 2
    $dash = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 2
    if ($r.ok -eq $true -and $r.localLaptopSafeMode -eq $true -and
      $r.instagramSendEnabled -eq $false -and $r.whatsappSendEnabled -eq $false -and
      $r.instagramEngineEnabled -eq $false -and $r.peteLlmCostGateApproved -eq $false -and
      $dash.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if (-not $ready) { Stop-Safe "Backend/Dashboard-Readiness nicht sicher. Serverfenster schliessen." }
New-Item -ItemType Directory -Path (Split-Path $readyFile -Parent) -Force | Out-Null
Set-Content -LiteralPath $readyFile -Value $targetSha -Encoding Ascii
Write-Host ("START BEREIT: " + $targetSha.Substring(0,8) + " | KEIN LIVE-SEND | KI-KOSTEN AUS") -ForegroundColor Green
Write-Host "Calendly-Diagnose kann bei lokal vorhandenem Token read-only gestartet werden."
Write-Host "Keine echte Pete-KI ohne separate Kostenfreigabe. Diese Antwortquelle im Chat pruefen."
Start-Process "http://127.0.0.1:5173/" | Out-Null
