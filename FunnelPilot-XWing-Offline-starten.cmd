@echo off
setlocal
title Funnel Pilot X-Wing OFFLINE starten
if not exist "%~dp0scripts\start-xwing-offline.ps1" (
  echo FEHLER: Der sichere X-Wing-Starter fehlt.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-xwing-offline.ps1"
if errorlevel 1 (
  echo.
  echo SICHERHEITS-STOP. Bitte neue Serverfenster schliessen.
  pause
  exit /b 1
)
exit /b 0
