@echo off
setlocal
title Funnel Pilot - Ein Klick Update und Test
if not exist "%~dp0backend\package.json" (
 echo SICHERHEITS-STOP: Datei bitte in den vorhandenen Ordner FunnelPilot-Desktop-Test kopieren.
 pause
 exit /b 1
)
rem Der Batch-Ordner endet auf einen Backslash. Als zitiertes Argument
rem kann dieser unter Windows das abschliessende Anfuehrungszeichen maskieren.
rem Deshalb Verzeichnis wechseln und den Pfad als "." uebergeben.
pushd "%~dp0"
if errorlevel 1 (
 echo SICHERHEITS-STOP: Projektordner nicht erreichbar.
 pause
 exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0FunnelPilot-AutoStart.bootstrap.ps1" -SourceRoot "."
set "START_RC=%ERRORLEVEL%"
popd
if not "%START_RC%"=="0" (
 echo.
 echo Keine Aenderung an bisherigen lokalen Arbeitsdateien.
 echo Bitte Screenshot vom angezeigten Sicherheits-STOP schicken.
 pause
 exit /b 1
)
exit /b 0
