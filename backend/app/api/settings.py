from fastapi import APIRouter
from pydantic import BaseModel
from app.core.engine_wrapper import EngineWrapper

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
