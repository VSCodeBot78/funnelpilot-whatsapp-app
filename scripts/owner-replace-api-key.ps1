#requires -Version 5.1
# Explicit owner-only key correction after OpenAI HTTP 401.
# Does not make network calls, modify budget ledgers, or enable Meta sends.
$ErrorActionPreference = "Stop"

function Fail([string]$reason) { throw ("PETE-KI-001 STOP: " + $reason) }

if (-not $env:LOCALAPPDATA) { Fail "Windows Benutzerprofil nicht erkannt." }

$privateDir = Join-Path $env:LOCALAPPDATA "FunnelPilot\Private"
$keyFile = Join-Path $privateDir "openai-key-dpapi.txt"
$sourceFlag = Join-Path $privateDir "owner-dpapi-preferred.flag"

Write-Host "PETE-KI-001 | OpenAI-Schluessel lokal korrigieren" -ForegroundColor Cyan
Write-Host "Der Schluessel wird verdeckt eingegeben und nur verschluesselt fuer diesen Windows-Benutzer gespeichert."
Write-Host "Keine API-Abfrage, keine KI-Kosten, keine Aenderung an .env, Ledger oder Meta-Sends."
Write-Host "Falls du noch keinen gueltigen geheimen Projektschluessel hast: https://platform.openai.com/api-keys"
$secure = Read-Host "Richtigen OpenAI API-Key eingeben" -AsSecureString
if ($null -eq $secure -or $secure.Length -lt 20) { Fail "Kein gueltig langes Secret eingegeben." }

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plaintext = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if (!$plaintext -or $plaintext -notmatch '^sk-' -or $plaintext -match '[\r\n]' -or $plaintext.Trim() -ne $plaintext) {
    Fail "Schluessel-Format ungueltig. Kein Wert wurde gespeichert."
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable plaintext -ErrorAction SilentlyContinue
}
$encrypted = ConvertFrom-SecureString -SecureString $secure
if (-not $encrypted) { Fail "Windows-Verschluesselung fehlgeschlagen." }
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$tmpFile = Join-Path $privateDir ("openai-key-" + [Guid]::NewGuid().ToString("N") + ".tmp")
try {
  [IO.File]::WriteAllText($tmpFile, $encrypted, [Text.Encoding]::ASCII)
  try { $check = ((Get-Content -LiteralPath $tmpFile -Raw).Trim() | ConvertTo-SecureString) }
  catch { Fail "DPAPI-Verifikation fehlgeschlagen." }
  if ($check.Length -ne $secure.Length) { Fail "Verschluesselten Key nicht lesbar." }
  if (Test-Path -LiteralPath $keyFile) {
    $backup = Join-Path $privateDir ("openai-key-dpapi.backup-" + [Guid]::NewGuid().ToString("N") + ".txt")
    Copy-Item -LiteralPath $keyFile -Destination $backup -ErrorAction Stop
  }
  Move-Item -LiteralPath $tmpFile -Destination $keyFile -Force -ErrorAction Stop
  [IO.File]::WriteAllText($sourceFlag, "dpapi", [Text.Encoding]::ASCII)
} finally {
  if (Test-Path -LiteralPath $tmpFile) { Remove-Item -LiteralPath $tmpFile -Force }
}
Write-Host "OK: Verschluesselter Owner-Key aktualisiert. Dieser hat ab jetzt Vorrang vor alter Windows-Umgebung und backend/.env." -ForegroundColor Green
Write-Host "Jetzt alte Funnel-Pilot-Backend-Fenster schliessen und FunnelPilot-Laptop-GO.cmd NEU starten."
Write-Host "Danach einmal OpenAI-Verbindung pruefen. Keinen kostenpflichtigen Chat automatisch starten."
