@echo off
title Host Process
echo Starting Host Process...
cd /d "%~dp0"
npm run dev
pause

