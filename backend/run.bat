@echo off
cd /d "%~dp0"
pip install -r requirements.txt >nul 2>&1
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
