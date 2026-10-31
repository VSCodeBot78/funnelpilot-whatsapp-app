#requires -Version 5.1
# Owner-only laptop start. No Git writes, external sends, merges or paid API calls.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backend = Join-Path $root "backend"
$dashboard = Join-Path $root "dashboard"
$url = "http://127.0.0.1:5173/"
$minimumSha = "43b8ec796614967968ef8a015edbc5e4c6262d84"
function Fail([string]$why) { throw ("SICHERHEITS-STOP: " + $why) }
function Git([string[]]$arguments) {
  $result = @(& git.exe @arguments 2>$null)
  if ($LASTEXITCODE -ne 0) { Fail "Git konnte nicht sicher gelesen werden." }
  return (@($result) -join "").Trim()
}
function Port-Free([int]$number) {
  $listener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Parse("127.0.0.1"),$number)
  try { $listener.Start(); return $true }
  catch { return $false }
  finally { try { $listener.Stop() } catch {} }
}
function Launch([string]$name,[string]$folder,[string[]]$commands) {
  $escaped = $folder.Replace("'","''")
  $body = '$Host.UI.RawUI.WindowTitle = "' + $name + '"' + [Environment]::NewLine
  $body += "Set-Location -LiteralPath '$escaped'" + [Environment]::NewLine
  $body += '$ErrorActionPreference = "Stop"' + [Environment]::NewLine
  $body += ($commands -join [Environment]::NewLine)
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($body))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoLogo","-NoProfile","-NoExit","-EncodedCommand",$encoded) -WorkingDirectory $folder | Out-Null
}
function Safe($r) {
  if (!$r -or $r.ok -ne $true -or $r.status -ne "ready" -or
      $r.nodeEnv -ne "development" -or $r.localLaptopSafeMode -ne $true) { return $false }
  foreach($key in @("instagramEngineEnabled","instagramSendEnabled","whatsappSendEnabled",
    "instagramAllowAllSenders","instagramAutoEnableNewLeads","whatsappAllowAllRecipients","genericWebhooksEnabled")) {
    if ($r.$key -ne $false) { return $false }
  }
  return $r.instagramAllowedSenderCount -eq 0 -and $r.whatsappAllowedRecipientCount -eq 0 -and
    $r.destructiveRoutesDisabled -eq $true -and $r.peteLlmCostGateApproved -eq $false
}
function Load-Owner-Key {
  if ($env:OPENAI_API_KEY -and $env:OPENAI_API_KEY.Trim()) { return }
  $envFile = Join-Path $backend ".env"
  if ((Test-Path -LiteralPath $envFile) -and
      (Select-String -LiteralPath $envFile -Pattern '^\s*OPENAI_API_KEY\s*=\s*[^#\s].+' -Quiet)) {
    Write-Host "Bestehende lokale Backend-Keykonfiguration erkannt (Inhalt verborgen)."
    return
  }
  $privateDir = Join-Path $env:LOCALAPPDATA "FunnelPilot\Private"
  $privateFile = Join-Path $privateDir "openai-key-dpapi.txt"
  if (Test-Path -LiteralPath $privateFile) {
    try { $secure = ((Get-Content -LiteralPath $privateFile -Raw).Trim() | ConvertTo-SecureString) }
    catch { Fail "Windows-Key konnte nicht entschluesselt werden." }
  } else {
    Write-Host "Einmalige optionale Eingabe: API-Key lokal und verdeckt. ENTER = Offline-Labor." -ForegroundColor Yellow
    $secure = Read-Host "OpenAI API-Key" -AsSecureString
    if ($null -eq $secure -or $secure.Length -eq 0) { return }
    New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
    ConvertFrom-SecureString $secure | Set-Content -LiteralPath $privateFile -Encoding Ascii
  }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if (!$key -or $key.Length -lt 20 -or $key -match '[\r\n]') { Fail "Ungueltiges API-Key-Format." }
    $env:OPENAI_API_KEY = $key
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Variable key -ErrorAction SilentlyContinue
  }
}
function Shortcut {
  try {
    $desktop = [Environment]::GetFolderPath("DesktopDirectory")
    if (!$desktop) { return }
    $name = Join-Path $desktop "Funnel Pilot - Laptop GO.lnk"
    if (Test-Path $name) { return }
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($name)
    $link.TargetPath = Join-Path $root "FunnelPilot-Laptop-GO.cmd"
    $link.WorkingDirectory = $root
    $link.Description = "Funnel Pilot Dashboard 2.0 plus Pete lokaler Test"
    $link.Save()
  } catch { Write-Warning "Verknuepfung nicht erstellt. Startdatei bleibt verwendbar." }
}
Write-Host "FUNNEL PILOT | Laptop GO | Dashboard 2.0 + Pete" -ForegroundColor Cyan
foreach($program in @("git.exe","node.exe","npm.cmd")) {
  if (-not (Get-Command $program -ErrorAction SilentlyContinue)) { Fail "$program fehlt." }
}
if (-not (Test-Path (Join-Path $backend "package.json")) -or
    -not (Test-Path (Join-Path $dashboard "package.json"))) { Fail "Projektordner unvollstaendig." }
if ((Git @("-C",$root,"branch","--show-current")) -ne "feat/dashboard-v2-preview-20261023") {
  Fail "Falscher Checkout. Nur Dashboard PR193 verwenden."
}
$origin = Git @("-C",$root,"remote","get-url","origin")
if ($origin -notmatch '^(https://github\.com/VSCodeBot78/funnelpilot-whatsapp-app(?:\.git)?/?|git@github\.com:VSCodeBot78/funnelpilot-whatsapp-app(?:\.git)?)$') {
  Fail "Git-Remote gehoert nicht zum Projekt."
}
& git.exe -C $root merge-base --is-ancestor $minimumSha HEAD 2>$null
if ($LASTEXITCODE -ne 0) { Fail "Alter Code. Zuerst geschuetztes FF-only Update." }
$dirty = @(& git.exe -C $root status --porcelain)
if ($LASTEXITCODE -ne 0) { Fail "Git-Status fehlt." }
if ($dirty.Count -gt 0 -and $dirty[0]) {
  Write-Warning "Lokale Aenderungen vorhanden: nicht ueberschrieben, aber nicht CI-geprueft."
}
$major = [int](& node.exe -p "process.versions.node.split('.')[0]")
if ($LASTEXITCODE -ne 0 -or $major -lt 20) { Fail "Node.js 20+ erforderlich." }
if (-not (Test-Path (Join-Path $backend "node_modules\.bin\tsx.cmd")) -or
    -not (Test-Path (Join-Path $dashboard "node_modules\vite\bin\vite.js"))) {
  Fail "npm-Abhaengigkeiten fehlen; keine automatische Paketinstallation."
}
if (-not (Port-Free 3001) -or -not (Port-Free 5173)) {
  Fail "Backend-/Dashboard-Port schon belegt. Alte Fenster zuerst schliessen."
}
Load-Owner-Key
# Key is inherited only by backend. Not printed, persisted in repo or sent as command argument.
$protected = @(
  '$env:NODE_ENV = "development"',
  '$env:FUNNELPILOT_LOCAL_TEST_MODE = "true"',
  '$env:PORT = "3001"',
  '$env:CORS_ORIGIN = "http://127.0.0.1:5173"',
  '$env:INSTAGRAM_ENGINE_ENABLED = "false"',
  '$env:INSTAGRAM_SEND_ENABLED = "false"',
  '$env:INSTAGRAM_ALLOW_ALL_SENDERS = "false"',
  '$env:INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false"',
  '$env:INSTAGRAM_ALLOWED_SENDER_IDS = " "',
  '$env:WHATSAPP_SEND_ENABLED = "false"',
  '$env:WHATSAPP_ALLOW_ALL_RECIPIENTS = "false"',
  '$env:WHATSAPP_ALLOWED_RECIPIENT_IDS = " "',
  '$env:ENABLE_GENERIC_WEBHOOKS = "false"',
  '$env:DISABLE_DESTRUCTIVE_ROUTES = "true"',
  '$env:PETE_LLM_API_CALLS_APPROVED = "false"',
  '$env:PETE_LLM_CONVERSATION_ENABLED = "true"',
  '$env:OPENAI_MODEL = "gpt-6.1-sol"',
  'npm.cmd run dev'
)
Launch "Funnel Pilot Backend NoSend" $backend $protected
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Launch "Funnel Pilot Dashboard V2" $dashboard @('npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort')
$running = $false
for($attempt=0;$attempt -lt 40;$attempt++) {
  Start-Sleep -Seconds 1
  try {
    $b = Invoke-RestMethod -Uri "http://127.0.0.1:3001/health/readiness" -TimeoutSec 2
    $v = Invoke-RestMethod -Uri "http://127.0.0.1:5173/health/readiness" -TimeoutSec 2
    $page = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ((Safe $b) -and (Safe $v) -and $page.StatusCode -eq 200 -and
        $page.Content.Contains("/src/main.jsx")) { $running = $true; break }
  } catch {}
}
if (!$running) { Fail "Backend, Vite-Proxy oder Dashboard nicht sicher bereit." }
try {
  $headers = @{ Origin="http://127.0.0.1:5173"; "X-Pete-Desktop"="1" }
  $session = Invoke-RestMethod -Uri "http://127.0.0.1:5173/test-chat/desktop/session" -Method Post -Headers $headers -ContentType "application/json" -Body "{}" -SessionVariable lab -TimeoutSec 4
  if ($session.ok -ne $true -or $session.csrfToken -notmatch '^[a-f0-9]{64}$') { Fail "Pete Session fehlgeschlagen." }
  $headers["X-Pete-CSRF"] = $session.csrfToken
  $state = Invoke-RestMethod -Uri "http://127.0.0.1:5173/test-chat/desktop/status" -Method Post -WebSession $lab -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 4
  if ($state.ok -ne $true -or $state.sendsEnabled -ne $false -or $state.model -ne "gpt-6.1-sol") { Fail "Pete nicht testbereit." }
} catch { Fail "Pete-Session, CSRF oder Status noch nicht funktionsfaehig." }
Shortcut
Write-Host "START OK: Backend, Dashboard V2, Proxy und Pete-Session. Kein Live-Versand." -ForegroundColor Green
if ($state.providerConfigured -ne $true) {
  Write-Warning "Echte KI gesperrt: Key oder Provider fehlt."
} elseif ($state.budget.ok -ne $true -or
    ($state.budget.historyVerified -ne $true -and $state.budget.ownerManagedApprovalAvailable -ne $true)) {
  Write-Warning "Echte KI gesperrt: sichere Budget-/Historienfreigabe fehlt."
} else {
  Write-Host "KI vorbereitet, aber bezahlt AUS. Budget nur im Pete-Labor einschalten." -ForegroundColor Yellow
}
Start-Process $url | Out-Null
