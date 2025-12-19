from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import bot, accounts, settings, stream

from contextlib import asynccontextmanager
from app.services.deriv_connector import deriv_client # Imported Singleton

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Deriv Connector...")
    await deriv_client.connect()
    yield
    # Shutdown
    await deriv_client.disconnect()

app = FastAPI(title="Intelligent Trading Companion", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(bot.router, prefix="/bot", tags=["Bot"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(settings.router, prefix="/settings", tags=["Settings"])
app.include_router(stream.router, prefix="/stream", tags=["Stream"])

@app.get("/")
async def root():
    return {"message": "Trading Companion Backend Operational"}
