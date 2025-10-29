@echo off
chcp 65001 >nul
echo ================================================
echo 🌊 Smart Water Meter - Запуск сервера
echo ================================================
echo.

echo Проверка Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python не найден!
    echo.
    echo 📥 Установите Python:
    echo 1. Скачайте с https://www.python.org/downloads/
    echo 2. При установке отметьте "Add Python to PATH"
    echo 3. Перезапустите этот файл
    echo.
    pause
    exit /b 1
)

echo ✓ Python найден
python --version
echo.

echo Проверка Flask...
python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Flask не установлен. Установка...
    python -m pip install flask
    if %errorlevel% neq 0 (
        echo ❌ Ошибка установки Flask
        pause
        exit /b 1
    )
    echo ✓ Flask установлен
) else (
    echo ✓ Flask уже установлен
)
echo.

echo ================================================
echo 🚀 Запуск Flask сервера...
echo ================================================
echo.
echo Откройте браузер и перейдите на:
echo 👉 http://localhost:5000
echo.
echo Для остановки сервера нажмите Ctrl+C
echo ================================================
echo.

python app.py

pause
