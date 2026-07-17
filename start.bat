@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   足浴经营系统 - 一键启动
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo *** 未找到 npm!请确认 Node.js 已安装并在系统 PATH 中。 ***
  echo 当前可尝试:在开始菜单搜 "Node" 看是否安装;或用 Git Bash 跑 start.sh
  goto :end
)
where node >nul 2>nul
if errorlevel 1 (
  echo *** 未找到 node!请确认 Node.js 已安装并在系统 PATH 中。 ***
  goto :end
)

echo [1/3] 安装根依赖(concurrently)...
call npm install
if errorlevel 1 echo *** 根依赖安装失败,见上 ***

echo.
echo [2/3] 数据库迁移 + seed(账号 boss/boss123, mgr/mgr123)...
call npm run setup

echo.
echo [3/3] 启动后端(:3000)+ 前端(:5173),Ctrl+C 停止
echo 浏览器将自动打开 http://localhost:5173
start "" cmd /c "timeout /t 7 >nul && start http://localhost:5173"
call npm start

:end
echo.
echo (窗口可关闭。若服务已启动,关闭本窗口或 Ctrl+C 即停。)
pause
