#requires -Version 5.1
# Owner-only FF-only source update; never sends, merges PRs, resets or deploys.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$branch = "feat/dashboard-v2-preview-20261023"
function Stop-Safely([string]$message) { throw ("SICHERHEITS-STOP: " + $message) }
function Read-Git([string[]]$parameters) {
  $output = @(& git.exe -C $root @parameters 2>$null)
  if ($LASTEXITCODE -ne 0) { Stop-Safely "Git-Pruefung fehlgeschlagen." }
  return (@($output) -join "`n").Trim()
}
function Ensure-PortFree([int]$port) {
  $listener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Parse("127.0.0.1"),$port)
  try { $listener.Start() }
  catch { Stop-Safely ("Port " + $port + " belegt. Bestehende Backend-/Dashboard-Fenster zuerst normal schliessen und erneut klicken.") }
  finally { try { $listener.Stop() } catch {} }
}
foreach($program in @("git.exe","node.exe","npm.cmd")) {
  if (-not (Get-Command $program -ErrorAction SilentlyContinue)) { Stop-Safely ("Programm fehlt: " + $program) }
}
if ((Read-Git @("branch","--show-current")) -ne $branch) {
  Stop-Safely "Nicht der bestehende PR193-Owner-Checkout. Kein Update."
}
$remote = Read-Git @("remote","get-url","origin")
if ($remote -notmatch '^(https://github\.com/VSCodeBot78/funnelpilot-whatsapp-app(?:\.git)?/?|git@github\.com:VSCodeBot78/funnelpilot-whatsapp-app(?:\.git)?)$') {
  Stop-Safely "Falscher GitHub-Remote. Kein Update."
}
# Avoid updating files while an older backend serves from the same checkout.
Ensure-PortFree 3001
Ensure-PortFree 5173
$dirty = @( & git.exe -C $root status --porcelain --untracked-files=normal )
if ($LASTEXITCODE -ne 0) { Stop-Safely "Lokaler Git-Status unlesbar." }
if ($dirty.Count -gt 0 -and ($dirty -join "").Trim()) {
  Write-Warning ("Lokale Aenderungen gefunden. Dateien bleiben unangetastet:\n" + ($dirty -join "`n"))
  Stop-Safely "Update nicht moeglich, bevor lokale Aenderungen kontrolliert geklaert sind."
}
$before = Read-Git @("rev-parse","HEAD")
Write-Host ("Lokaler Stand: " + $before.Substring(0,8)) -ForegroundColor Cyan
& git.exe -C $root fetch --no-tags origin ("+refs/heads/" + $branch + ":refs/remotes/origin/" + $branch)
if ($LASTEXITCODE -ne 0) { Stop-Safely "GitHub nicht erreichbar oder Fetch gescheitert. Keine Aenderung." }
$target = Read-Git @("rev-parse","refs/remotes/origin/" + $branch)
& git.exe -C $root merge-base --is-ancestor HEAD $target
if ($LASTEXITCODE -ne 0) { Stop-Safely "Kein reiner Fast-Forward. Keine Aenderung." }
if ($before -ne $target) {
  Write-Host ("Sicheres Update auf " + $target.Substring(0,8)) -ForegroundColor Cyan
  & git.exe -C $root merge --ff-only $target
  if ($LASTEXITCODE -ne 0) { Stop-Safely "Fast-Forward fehlgeschlagen. Keine Resets." }
} else {
  Write-Host "Keine neuen GitHub-Aenderungen." -ForegroundColor Green
}
$after = Read-Git @("rev-parse","HEAD")
if ($after -ne $target) { Stop-Safely "HEAD nach Update nicht identisch mit GitHub. Nicht starten." }
# No package installation, paid API call, live send or deployment at startup.
# Existing dependencies must be present; source checks run before starting services.
if (-not (Test-Path (Join-Path $root "backend/node_modules/.bin/tsx.cmd")) -or
    -not (Test-Path (Join-Path $root "dashboard/node_modules/vite/bin/vite.js"))) {
  Stop-Safely "Node-Abhaengigkeiten fehlen. Kein automatisches npm ci. Erst kontrolliert reparieren."
}
if ($before -ne $after) {
  Write-Host "Pruefe aktualisierten Backend-Typenbau..." -ForegroundColor Cyan
  & npm.cmd --prefix (Join-Path $root "backend") run build
  if ($LASTEXITCODE -ne 0) { Stop-Safely "Backend-Build fehlgeschlagen. Neue Version NICHT starten." }
  Write-Host "Pruefe aktualisiertes Dashboard inklusive Offline-Tests..." -ForegroundColor Cyan
  & npm.cmd --prefix (Join-Path $root "dashboard") run build
  if ($LASTEXITCODE -ne 0) { Stop-Safely "Dashboard-Build/Tests fehlgeschlagen. Neue Version NICHT starten." }
  Write-Host "Pruefe Pete-Kalenderlink-Regression ohne OpenAI..." -ForegroundColor Cyan
  & npm.cmd --prefix (Join-Path $root "backend") exec -- node --import tsx --test src/config/pete-llm-phase46.test.ts
  if ($LASTEXITCODE -ne 0) { Stop-Safely "Pete-Offline-Test fehlgeschlagen. Neue Version NICHT starten." }
}
$committed = Read-Git @("log","-1","--format=%cs")
$env:VITE_FP_BUILD_SHA = $after.Substring(0,8)
$env:VITE_FP_BUILD_DATE = $committed
$env:FUNNELPILOT_BUILD_SHA = $after.Substring(0,8)
$env:FUNNELPILOT_BUILD_DATE = $committed
Write-Host ("VERSION: Pete V5 / Dashboard V2 | Build " + $committed + " | " + $after.Substring(0,8)) -ForegroundColor Green
exit 0
