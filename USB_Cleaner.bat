@echo off
chcp 65001 >nul
title USB Cleaner by Ahmed Amer
color 0a

echo ********************************************
echo *        USB Cleaning and Protection        *
echo *           Created by: Ahmed Amer          *
echo ********************************************
echo.

:: Ask for drive letter
set /p drive=Enter the USB drive letter (Example: E): 
echo.

if not exist %drive%:\ (
    echo Drive not found.
    pause
    exit /b
)

echo Cleaning drive %drive%:\
echo ------------------------------------------

:: Remove hidden, read-only, and system attributes (silenced)
attrib -h -r -s /s /d %drive%:\*.* >nul 2>&1

:: Delete possible virus files (silenced so "Could Not Find" doesn't show)
del /f /s /q /a %drive%:\autorun.inf >nul 2>&1
del /f /s /q /a %drive%:\*.lnk >nul 2>&1
del /f /s /q /a %drive%:\*.vbs >nul 2>&1
del /f /s /q /a %drive%:\*.exe >nul 2>&1

:: Create a protective autorun.inf folder (silenced)
if not exist %drive%:\autorun.inf (
    mkdir %drive%:\autorun.inf >nul 2>&1
)
attrib +h +s %drive%:\autorun.inf >nul 2>&1

:: Hide the System Volume Information folder (silenced)
if exist %drive%:\System Volume Information (
    attrib +h +s "%drive%:\System Volume Information" >nul 2>&1
)

echo ------------------------------------------
echo USB drive cleaned and protected successfully!
echo You can now use it safely.
echo ------------------------------------------
pause
exit
