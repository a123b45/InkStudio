@echo off
chcp 65001 >nul
title Slate MERN App - 一键启动

echo ============================================
echo   Slate MERN App - 一键启动
echo ============================================
echo.

REM ========== 1. 启动 MongoDB ==========
set MONGO_DIR=%~dp0mongodb
set DATA_DIR=%~dp0mongodb-data

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

echo [1/3] 正在启动 MongoDB...
start "MongoDB" "%MONGO_DIR%\bin\mongod.exe" --dbpath "%DATA_DIR%" --port 27017 --auth

REM 等待 MongoDB 就绪（首次启动约需5-10秒）
echo        等待 MongoDB 启动（约8秒）...
timeout /t 8 /nobreak >nul
echo        MongoDB 已启动 ✓
echo.

REM ========== 2. 安装依赖（如需要） ==========
echo [2/3] 检查依赖...
if not exist "%~dp0node_modules" (
    echo        正在安装根目录依赖...
    call npm install
)
if not exist "%~dp0server\node_modules" (
    echo        正在安装 server 依赖...
    cd /d "%~dp0server"
    call npm install
    cd /d "%~dp0"
)
if not exist "%~dp0client\node_modules" (
    echo        正在安装 client 依赖...
    cd /d "%~dp0client"
    call npm install
    cd /d "%~dp0"
)
echo        依赖检查完成 ✓
echo.

REM ========== 3. 启动前后端 ==========
echo [3/3] 启动前后端开发服务器...
echo.
echo   前端: http://localhost:5173
echo   后端: http://localhost:5000
echo   MongoDB: localhost:27017
echo.
echo   按 Ctrl+C 停止 npm dev（MongoDB 窗口需手动关闭）
echo ============================================
echo.

REM 打开浏览器
start "" http://localhost:5173

REM 启动 dev 服务（前台运行，Ctrl+C 可全部停止）
call npm run dev

pause
