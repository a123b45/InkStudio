@echo off
REM Start MongoDB locally for Slate MERN App
set MONGO_DIR=%~dp0mongodb
set DATA_DIR=%~dp0mongodb-data

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

echo Starting MongoDB...
echo Data directory: %DATA_DIR%
echo.

"%MONGO_DIR%\bin\mongod.exe" --dbpath "%DATA_DIR%" --port 27017 --auth
