@echo off
setlocal
title Funnel Pilot - API Key reparieren
if not exist "%~dp0scripts\owner-replace-api-key.ps1" (
 echo STOP: API-Key-Reparaturskript fehlt im bestehenden Projekt-Checkout.
 pause
 exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\owner-replace-api-key.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
 echo.
 echo Reparatur NICHT abgeschlossen. Alter Key und Kostenledger wurden nicht geloescht.
 pause
 exit /b 1
)
echo.
echo Key lokal aktualisiert. Bitte Backend-Fenster schliessen und danach FunnelPilot-Laptop-GO.cmd starten.
pause
exit /b 0
