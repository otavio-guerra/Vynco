@echo off
chcp 65001 >nul
title Vynco
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Vynco precisa do Node.js 20 ou mais novo.
  echo  Vou abrir a pagina de download. Instale, feche esta janela e abra o Vynco de novo.
  echo.
  start "" "https://nodejs.org/pt-br/download"
  pause
  exit /b 1
)
echo.
echo  Vynco rodando em http://127.0.0.1:4800
echo  Deixe esta janela aberta enquanto usa o app. Para sair, feche a janela.
echo.
rem abre o navegador 2 segundos depois, quando o servidor já estiver de pé
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://127.0.0.1:4800"
node app\server.js
pause
