import logging
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.engine_wrapper import EngineWrapper
from app.services.deriv_connector import deriv_client

logger = logging.getLogger("settings")

router = APIRouter()

class StrategySettings(BaseModel):
    gridSize: int
    riskPercent: float
    maxLots: float
    confidenceThreshold: float
    stopLossPoints: float
    takeProfitPoints: float
    maxOpenTrades: int
    drawdownLimit: float

@router.get("/")
def get_settings():
    # Return defaults for now
    return {
        "gridSize": 10,
        "riskPercent": 2.0,
        "maxLots": 1.0,
        "confidenceThreshold": 0.75,
        "stopLossPoints": 50,
        "takeProfitPoints": 100,
        "maxOpenTrades": 5,
        "drawdownLimit": 10
    }

@router.post("/token")
async def update_token(req: dict):
    token = req.get("token")
    app_id = req.get("appId")
    print(f">>> BACKEND: Received token sync request for App ID: {app_id}")
    if not token:
        return {"status": "error", "message": "Token is required"}
    
    # Update token and reconnect
    logger.info(f"Updating backend token for App ID: {app_id}")
    deriv_client.token = token
    if app_id:
        deriv_client.app_id = app_id
        
    await deriv_client.disconnect()
    await deriv_client.connect()
    print(">>> BACKEND: Token updated and Reconnected.")
    
    return {"status": "success", "message": "Token updated and reconnecting..."}

@router.post("/")
def update_settings(settings: StrategySettings):
    # Map Pydantic model to dict for engine wrapper
    config_dict = {
        "grid_size": settings.gridSize,
        "risk_percent": settings.riskPercent,
        "max_lots": settings.maxLots,
        "confidence_threshold": settings.confidenceThreshold,
        "stop_loss_points": settings.stopLossPoints,
        "take_profit_points": settings.takeProfitPoints,
        "max_open_trades": settings.maxOpenTrades,
        "drawdown_limit": settings.drawdownLimit 
    }
    EngineWrapper.update_config(config_dict)
    return {"status": "success", "settings": settings}
