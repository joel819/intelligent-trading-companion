from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import bot, accounts, settings, stream, logs, trades, market

from contextlib import asynccontextmanager
from app.services.deriv_connector import deriv_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting ML Service...")
    await deriv_client.connect()
    yield
    # Shutdown
    await deriv_client.disconnect()

app = FastAPI(title="Intelligent Trading Companion", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8081", "http://localhost:5173", "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(bot.router, prefix="/bot", tags=["Bot"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(settings.router, prefix="/settings", tags=["Settings"])
app.include_router(market.router, prefix="/market", tags=["Market"])
app.include_router(trades.router, prefix="/trade", tags=["Trades"])
app.include_router(stream.router, prefix="/stream", tags=["Stream"])
app.include_router(logs.router, prefix="/logs", tags=["Logs"])
app.include_router(trades.router, prefix="", tags=["Trades"])

# ML Router
from app.api import ml
app.include_router(ml.router, prefix="/ml", tags=["Machine Learning"])

@app.get("/")
async def root():
    return {"message": "ML Inference Service Operational"}
