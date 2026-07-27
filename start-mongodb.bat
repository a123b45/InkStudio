@echo off
REM 启动 MongoDB — 优先内置，其次系统 PATH / Windows 服务
setlocal EnableDelayedExpansion
chcp 65001 >nul

set ROOT=%~dp0
set MONGO_DIR=%ROOT%mongodb
set DATA_DIR=%ROOT%mongodb-data

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

echo ============================================
echo   InkStudio - 启动 MongoDB
echo ============================================
echo.

REM 已在运行则直接退出
netstat -ano | findstr ":27017" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo MongoDB 已在运行 (端口 27017^)
  goto done
)

REM 1) 内置 MongoDB
if exist "%MONGO_DIR%\bin\mongod.exe" (
  echo 模式: 内置 MongoDB (带认证^)
  echo 数据目录: %DATA_DIR%
  echo.
  "%MONGO_DIR%\bin\mongod.exe" --dbpath "%DATA_DIR%" --port 27017 --auth
  goto done
)

REM 2) 系统 PATH 中的 mongod
where mongod >nul 2>&1
if %errorlevel%==0 (
  echo 模式: 系统 MongoDB (mongod^)
  echo 数据目录: %DATA_DIR%
  echo.
  mongod --dbpath "%DATA_DIR%" --port 27017
  goto done
)

REM 3) Windows 服务
sc query MongoDB >nul 2>&1
if %errorlevel%==0 (
  echo 模式: MongoDB Windows 服务
  net start MongoDB
  goto done
)

echo [错误] 未找到 MongoDB。
echo   - 将 mongodb 文件夹放在项目根目录，或
echo   - 安装 MongoDB 并加入 PATH，或
echo   - 安装 MongoDB Windows 服务
echo.
pause
exit /b 1

:done
echo.
pause
