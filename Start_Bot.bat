@echo off
title Launcher - Agri Prima Indotama
color 0B
echo ===================================================
echo   Menjalankan WhatsApp Bot ^& Web Dashboard...
echo ===================================================
echo.
echo Membuka server Next.js Dashboard...
start "Agri Prima Dashboard" cmd /c "cd dashboard && npm run dev"

echo Membuka server WhatsApp Bot...
start "Agri Prima Bot Engine" cmd /k "bun index.js || "%USERPROFILE%\.bun\bin\bun.exe" index.js"

echo Selesai! Kedua sistem telah berjalan di dua jendela terminal terpisah.
echo.
echo 🌐 Buka http://localhost:3000 untuk mengakses Web Dashboard.
echo 🤖 Jendela "Agri Prima Bot Engine" akan memunculkan QR Code WhatsApp.
echo.
echo Jika ingin mematikan sistem, tutup kedua jendela terminal tersebut.
echo.
pause
