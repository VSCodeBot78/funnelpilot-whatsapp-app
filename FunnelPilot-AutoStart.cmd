@echo off
setlocal
title Funnel Pilot - Ein Klick Update und Test
if not exist "%~dp0backend\package.json" (
 echo SICHERHEITS-STOP: Datei bitte in den vorhandenen Ordner FunnelPilot-Desktop-Test kopieren.
 pause
 exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0FunnelPilot-AutoStart.bootstrap.ps1" -SourceRoot "%~dp0"
if errorlevel 1 (
 echo.
 echo Keine Aenderung an bisherigen lokalen Arbeitsdateien.
 echo Bitte Screenshot vom angezeigten Sicherheits-STOP schicken.
 pause
 exit /b 1
)
exit /b 0
