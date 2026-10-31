@echo off
setlocal
title Funnel Pilot - Laptop GO
if not exist "%~dp0scripts\start-owner-laptop.ps1" (
 echo SICHERHEITS-STOP: Ein-Klick-Starter fehlt im Dashboard-PR193-Checkout.
 pause
 exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-owner-laptop.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
 echo.
 echo Start nicht vollstaendig. Keine Meta-Sends oder bezahlten KI-Aufrufe freigegeben.
 pause
 exit /b 1
)
exit /b 0
