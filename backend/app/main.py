from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import bot, accounts, settings

app = FastAPI(title="Intelligent Trading Companion")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "*"], # Allow Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(bot.router, prefix="/bot", tags=["Bot"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(settings.router, prefix="/settings", tags=["Settings"])

@app.get("/")
async def root():
    return {"message": "Trading Companion Backend Operational"}
