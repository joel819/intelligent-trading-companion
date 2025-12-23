import logging
import asyncio
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
    symbol: str = "R_100"

@router.get("/")
def get_settings():
    # Return current config from deriv_client
    config = deriv_client.default_config
    return {
        "gridSize": config.get("grid_size", 10),
        "riskPercent": config.get("risk_percent", 2.0),
        "maxLots": config.get("max_lots", 1.0),
        "confidenceThreshold": config.get("confidence_threshold", 0.75),
        "stopLossPoints": config.get("stop_loss_points", 50),
        "takeProfitPoints": config.get("take_profit_points", 100),
        "maxOpenTrades": config.get("max_open_trades", 5),
        "drawdownLimit": config.get("drawdown_limit", 10),
        "symbol": deriv_client.target_symbol
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
async def update_settings(settings: StrategySettings):
    try:
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
        
        # Update deriv_client for persistence during session
        deriv_client.default_config.update(config_dict)
        logger.info(f"Settings Updated in DerivClient: {deriv_client.default_config}")
        
        # Handle symbol switch
        if settings.symbol != deriv_client.target_symbol:
            asyncio.create_task(deriv_client.switch_symbol(settings.symbol))

        # Push to C++ Engine
        EngineWrapper.update_config(config_dict)
        
        logger.info(f"Strategy settings updated: {config_dict}")
        return {"status": "success", "settings": settings}
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        return {"status": "error", "message": str(e)}
