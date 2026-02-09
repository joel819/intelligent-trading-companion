#!/bin/bash

# Ensure PyInstaller is installed
pip install pyinstaller

# Build the executable
# --onefile: Create a single executable file
# --name: Name of the executable
# --add-data: Include the dist directory (frontend)
# --add-data: Include the backend directory (application logic)
# --hidden-import: Handle imports that PyInstaller might miss
# --clean: Clean PyInstaller cache and remove temporary files

pyinstaller --noconfirm --onefile --windowed --clean \
    --name "intelligent_trading_companion" \
    --add-data "dist:dist" \
    --add-data "backend/app:app" \
    --add-data "backend/.env:.env" \
    --hidden-import "uvicorn.logging" \
    --hidden-import "fastapi.middleware.cors" \
    --hidden-import "starlette.middleware.cors" \
    --hidden-import "email_validator" \
    --hidden-import "numpy" \
    --hidden-import "pandas" \
    --hidden-import "openai" \
    --hidden-import "dotenv" \
    --hidden-import "websockets" \
    --hidden-import "sse_starlette" \
    --hidden-import "python_multipart" \
    --hidden-import "uvicorn.loops" \
    --hidden-import "uvicorn.loops.auto" \
    --hidden-import "uvicorn.protocols" \
    --hidden-import "uvicorn.protocols.http" \
    --hidden-import "uvicorn.protocols.http.auto" \
    --hidden-import "uvicorn.lifespan" \
    --hidden-import "uvicorn.lifespan.on" \
    --hidden-import "engineio.async_drivers.asgi" \
    --hidden-import "socketio.async_drivers.asgi" \
    --collect-all "app" \
    run_executable.py
