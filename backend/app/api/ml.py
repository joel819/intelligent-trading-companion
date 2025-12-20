from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.engine_wrapper import EngineWrapper

router = APIRouter()

class TickData(BaseModel):
    symbol: str
    bid: float
    ask: float
    epoch: int

class PositionData(BaseModel):
    ticket: int
    type: str # 'buy' or 'sell'
    entry_price: float
    volume: float
    sl: float
    tp: float

class PredictionRequest(BaseModel):
    tick: TickData
    open_positions: List[PositionData] = []

@router.post("/predict")
def predict(request: PredictionRequest):
    try:
        # Convert Pydantic models to dicts for the engine wrapper
        tick_dict = request.tick.dict()
        positions_list = [p.dict() for p in request.open_positions]
        
        # Call the C++ Engine / ML Model
        signal = EngineWrapper.process_tick(tick_dict, positions_list)
        
        return signal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
