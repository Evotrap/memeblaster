@echo off
title MemeBlaster - Build Setup
color 0A

:: Se place automatiquement dans le dossier du .bat, peu importe comment il est lancé
cd /d "%~dp0"

echo.
echo  ==========================================
echo   MemeBlaster - Creation du .exe
echo  ==========================================
echo  Dossier : %~dp0
echo.

:: Vérifie que Node.js est installé
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERREUR] Node.js n'est pas installe !
    echo.
    echo  Telechargez-le ici : https://nodejs.org
    echo  Installez la version LTS puis relancez ce script.
    echo.
    pause
    exit /b 1
)

echo  [1/3] Node.js detecte :
node --version
echo.

echo  [2/3] Installation des dependances...
call npm install
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  [ERREUR] npm install a echoue.
    pause
    exit /b 1
)

echo.
echo  [3/3] Compilation du .exe...
call npm run build:win
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  [ERREUR] La compilation a echoue.
    pause
    exit /b 1
)

echo.
color 0A
echo  ==========================================
echo   SUCCES ! Ton installeur est dans :
echo   dist\MemeBlaster Setup 1.0.0.exe
echo  ==========================================
echo.
echo  Partage ce fichier .exe a tes amis !
echo.

start "" "dist"
pause
