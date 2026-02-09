import os
import sys
import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi import Request
from fastapi.responses import FileResponse
from dotenv import load_dotenv

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

# Load .env file BEFORE importing the app
# 1. Load Bundled .env (Base)
env_path = resource_path(".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"Loaded bundled environment from: {env_path}")

# 2. Check for External .env files to override (Priority: Next to Exe > CWD > Backend)
search_paths = []

# If frozen (PyInstaller), look next to executable
if getattr(sys, 'frozen', False):
    search_paths.append(os.path.join(os.path.dirname(sys.executable), ".env"))

# Look in CWD and backend/ (Development/Source structure)
cwd = os.getcwd()
search_paths.extend([
    os.path.join(cwd, ".env"),
    os.path.join(cwd, "backend", ".env")
])

for p in search_paths:
    if os.path.exists(p):
        load_dotenv(p, override=True)
        print(f"Loaded environment override from: {p}")

# Debug Token Presence (Masked)
token = os.getenv("DERIV_TOKEN")
real_token = os.getenv("DERIV_REAL_TOKEN")
print(f"DERIV_TOKEN present: {'Yes' if token else 'No'} ({token[:4]}... if Yes)")
print(f"DERIV_REAL_TOKEN present: {'Yes' if real_token else 'No'}")

# Add backend to sys.path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
sys.path.append(backend_dir)

from app.main import app



# Mount the static files from the 'dist' directory
# In PyInstaller, we will add 'dist' as a data folder
static_dir = resource_path("dist")

if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    
    # Serve index.html for the root and any other routes (SPA handling)
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Allow API routes to pass through
        if full_path.startswith("api") or full_path.startswith("bot") or full_path.startswith("accounts") or full_path.startswith("settings") or full_path.startswith("market") or full_path.startswith("trade") or full_path.startswith("stream") or full_path.startswith("logs") or full_path.startswith("ml") or full_path.startswith("strategies") or full_path.startswith("journal") or full_path.startswith("backtest") or full_path.startswith("ai") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
             return await app.router.handle_request(request)

        # Check if file exists in static dir (e.g. favicon.ico)
        possible_file = os.path.join(static_dir, full_path)
        if os.path.isfile(possible_file):
            return FileResponse(possible_file)
            
        return FileResponse(os.path.join(static_dir, "index.html"))
else:
    print(f"Warning: Static directory {static_dir} not found. Frontend will not be served.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
