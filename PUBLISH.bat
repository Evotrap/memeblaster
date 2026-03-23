@echo off
title MemeBlaster - Publication GitHub
color 0A
cd /d "%~dp0"

echo.
echo  ==========================================
echo   MemeBlaster - Publication d'une MAJ
echo  ==========================================
echo.

:: Vérifie Node.js
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERREUR] Node.js n'est pas installe !
    pause & exit /b 1
)

:: Demande le token GitHub
echo  Entre ton token GitHub puis appuie sur Entree :
echo  (github.com/settings/tokens - scope "repo")
echo.
set /p GH_TOKEN=  Token : 

IF "%GH_TOKEN%"=="" (
    color 0C
    echo  [ERREUR] Token vide !
    pause & exit /b 1
)

:: Demande la nouvelle version
echo.
for /f "tokens=2 delims=:, " %%v in ('findstr /r "\"version\"" package.json') do (
    set CURRENT_VER=%%~v
)
echo  Version actuelle : %CURRENT_VER%
echo  Nouvelle version (ex: 1.1.0) :
set /p NEW_VER=  Version : 

IF "%NEW_VER%"=="" (
    color 0C
    echo  [ERREUR] Version vide !
    pause & exit /b 1
)

:: Met à jour la version dans package.json
echo.
echo  [1/4] Mise a jour de la version ^(%NEW_VER%^)...
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version='%NEW_VER%'; fs.writeFileSync('package.json',JSON.stringify(p,null,2));"

:: Installe les dépendances si besoin
echo  [2/4] Verification des dependances...
call npm install --silent
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERREUR] npm install a echoue.
    pause & exit /b 1
)

:: Compile et publie sur GitHub
echo  [3/4] Compilation et publication sur GitHub...
set GH_TOKEN=%GH_TOKEN%
call npm run publish
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  [ERREUR] La publication a echoue.
    echo  Verifie que ton token GitHub est correct et a le scope "repo".
    pause & exit /b 1
)

echo.
color 0A
echo  ==========================================
echo   SUCCES ! Version %NEW_VER% publiee !
echo.
echo   Tes amis recevront la MAJ automatiquement
echo   au prochain demarrage de MemeBlaster.
echo  ==========================================
echo.
pause
