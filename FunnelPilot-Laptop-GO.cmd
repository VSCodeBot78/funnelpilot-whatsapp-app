@echo off
setlocal
title Funnel Pilot - Laptop GO
if not exist "%~dp0scripts\update-owner-laptop.ps1" (
 echo SICHERHEITS-STOP: Geschuetzter Updater fehlt im Dashboard-PR193-Checkout.
 pause
 exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update-owner-laptop.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
 echo.
 echo Update oder Start gescheitert. Kein Meta-Versand oder automatischer KI-Aufruf.
 pause
 exit /b 1
)
exit /b 0
