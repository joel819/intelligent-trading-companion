from fastapi import APIRouter
from pydantic import BaseModel
from app.core.engine_wrapper import EngineWrapper

router = APIRouter()

class BotToggleRequest(BaseModel):
    command: str  # "start", "stop", "panic"

@router.get("/status")
def get_status():
    state = EngineWrapper.get_bot_state()
    # Mocking extra data for now to match UI
    return {
        "isRunning": state["is_running"],
        "strategy": "Grid/ML Hybrid", # Placeholder
        "lastTrade": None,
        "uptime": state["uptime_seconds"],
        "tradesExecuted": state["total_trades"],
        "profitToday": state["total_pnl"]
    }

@router.post("/toggle")
def toggle_bot(req: BotToggleRequest):
    if req.command == "start":
        EngineWrapper.set_bot_state(True)
    elif req.command == "stop":
        EngineWrapper.set_bot_state(False)
    elif req.command == "panic":
        EngineWrapper.set_bot_state(False)
        # TODO: Add logic to close all trades immediately
    return {"status": "success", "command": req.command}
