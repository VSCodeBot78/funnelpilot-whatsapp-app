@echo off
setlocal
title Funnel Pilot - Desktop-Test starten
set "DASHBOARD=%~dp0dashboard"

if not exist "%DASHBOARD%\package.json" (
  echo FEHLER: Dashboard-Ordner nicht gefunden.
  echo Bitte diese Datei im FunnelPilot-Desktop-Test-Ordner starten.
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo FEHLER: Node.js und npm sind auf diesem PC nicht gefunden worden.
  echo Bitte Node.js installieren oder die Windows-PATH-Einstellung pruefen.
  pause
  exit /b 1
)

if not exist "%DASHBOARD%\node_modules\vite\bin\vite.js" (
  echo FEHLER: Die Dashboard-Abhaengigkeiten sind noch nicht installiert.
  echo Einmalig im Dashboard-Ordner npm ci ausfuehren.
  echo Das Skript installiert aus Sicherheitsgruenden nichts automatisch.
  pause
  exit /b 1
)

echo Funnel Pilot Desktop-Test wird lokal gestartet...
echo Adresse: http://127.0.0.1:5173/
echo Der Backend-Server wird NICHT gestartet.
echo Es erfolgt kein Instagram- oder WhatsApp-Versand durch dieses Skript.
echo.
start "Funnel Pilot Desktop-Testserver" /D "%DASHBOARD%" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
if errorlevel 1 (
  echo Konnte das Testserver-Fenster nicht oeffnen.
  pause
  exit /b 1
)
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173/"
echo.
echo Der Browser wird geoeffnet. Bitte das Testserver-Fenster
echo waehrend der Benutzung geoeffnet lassen.
echo Zum Beenden im Testserver-Fenster STRG+C druecken.
exit /b 0
