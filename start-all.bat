@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title InkStudio - 一键启动

echo ============================================
echo   InkStudio - 一键启动
echo ============================================
echo.

set ROOT=%~dp0
set MONGO_DIR=%ROOT%mongodb
set DATA_DIR=%ROOT%mongodb-data
set MONGO_MODE=unknown
set MONGO_STARTED=0

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM ========== 1. 启动 MongoDB ==========
echo [1/3] 正在检查 MongoDB...

netstat -ano | findstr ":27017" | findstr "LISTENING" >nul 2>&1
if !errorlevel!==0 (
  echo        检测到 MongoDB 已在运行 (端口 27017^) ✓
  set MONGO_MODE=existing
  set MONGO_STARTED=1
  goto mongo_ready
)

if exist "%MONGO_DIR%\bin\mongod.exe" (
  echo        使用内置 MongoDB (带认证^)...
  start "MongoDB" "%MONGO_DIR%\bin\mongod.exe" --dbpath "%DATA_DIR%" --port 27017 --auth
  set MONGO_MODE=bundled
  set MONGO_STARTED=1
  goto mongo_wait
)

where mongod >nul 2>&1
if !errorlevel!==0 (
  echo        使用系统 MongoDB (mongod^)...
  start "MongoDB" mongod --dbpath "%DATA_DIR%" --port 27017
  set MONGO_MODE=system
  set MONGO_STARTED=1
  set MONGO_URI=mongodb://localhost:27017/slate-mern-app
  goto mongo_wait
)

sc query MongoDB >nul 2>&1
if !errorlevel!==0 (
  echo        尝试启动 MongoDB Windows 服务...
  net start MongoDB >nul 2>&1
  timeout /t 3 /nobreak >nul
  netstat -ano | findstr ":27017" | findstr "LISTENING" >nul 2>&1
  if !errorlevel!==0 (
    echo        MongoDB 服务已启动 ✓
    set MONGO_MODE=service
    set MONGO_STARTED=1
    set MONGO_URI=mongodb://localhost:27017/slate-mern-app
    goto mongo_ready
  )
)

echo.
echo [错误] 未找到 MongoDB，无法启动。请任选其一：
echo   1. 将 mongodb 文件夹放在项目根目录 (与 start-all.bat 同级^)
echo   2. 安装 MongoDB 并加入 PATH
echo      https://www.mongodb.com/try/download/community
echo   3. 安装并启动 MongoDB Windows 服务
echo.
pause
exit /b 1

:mongo_wait
echo        等待 MongoDB 启动 (约8秒^)...
timeout /t 8 /nobreak >nul

netstat -ano | findstr ":27017" | findstr "LISTENING" >nul 2>&1
if !errorlevel! neq 0 (
  echo [警告] MongoDB 可能尚未就绪，请查看 MongoDB 窗口是否有报错
)

:mongo_ready
if "!MONGO_MODE!"=="bundled" (
  echo        模式: 内置 MongoDB ^| 认证: 是 ^| 数据: %DATA_DIR%
) else if "!MONGO_MODE!"=="system" (
  echo        模式: 系统 mongod ^| 认证: 否 ^| 数据: %DATA_DIR%
) else if "!MONGO_MODE!"=="service" (
  echo        模式: Windows 服务 ^| 认证: 否
) else (
  echo        模式: 已有实例 (端口 27017^)
)
echo.

REM ========== 2. 安装依赖（如需要） ==========
echo [2/3] 检查依赖...
if not exist "%ROOT%node_modules" (
  echo        正在安装根目录依赖...
  call npm install
)
if not exist "%ROOT%server\node_modules" (
  echo        正在安装 server 依赖...
  cd /d "%ROOT%server"
  call npm install
  cd /d "%ROOT%"
)
if not exist "%ROOT%client\node_modules" (
  echo        正在安装 client 依赖...
  cd /d "%ROOT%client"
  call npm install
  cd /d "%ROOT%"
)
echo        依赖检查完成 ✓
echo.

REM ========== 3. 启动前后端 ==========
echo [3/3] 启动前后端开发服务器...
echo.
echo   前端: http://localhost:5173
echo   后端: http://localhost:5000
echo   MongoDB: localhost:27017
if defined MONGO_URI (
  echo   连接串: !MONGO_URI!
) else (
  echo   连接串: mongodb://appuser:***@localhost:27017/slate-mern-app (内置认证^)
)
echo.
echo   按 Ctrl+C 停止 npm dev (MongoDB 窗口需手动关闭^)
echo ============================================
echo.

start "" http://localhost:5173

cd /d "%ROOT%"
call npm run dev

pause
