from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from app.core.engine_wrapper import EngineWrapper

router = APIRouter()

class BotToggleRequest(BaseModel):
    command: str  # "start", "stop", "panic"

@router.get("/")
def get_status():
    from app.services.deriv_connector import deriv_client
    state = EngineWrapper.get_bot_state()
    
    is_authorized = deriv_client.current_account != {}
    
    # Determine Status String
    if not deriv_client.is_connected:
        strategy_label = "Disconnected"
    elif not is_authorized:
        strategy_label = "Ready (Not Authorized)"
    else:
        strategy_label = "Deriv Live"

    return {
        "isConnected": deriv_client.is_connected,
        "isRunning": state["is_running"],
        "isAuthorized": is_authorized,
        "strategy": strategy_label,
        "lastTrade": None,
        "uptime": state["uptime_seconds"],
        # Use session stats for P&L and Trades
        "tradesExecuted": deriv_client.session_stats["trades"],
        "profitToday": deriv_client.session_stats["pnl"],
        "account": deriv_client.active_account_id,
        "symbol": deriv_client.target_symbol
    }

@router.post("/toggle/")
def toggle_bot(req: BotToggleRequest):
    if req.command == "start":
        EngineWrapper.set_bot_state(True)
    elif req.command == "stop":
        EngineWrapper.set_bot_state(False)
    elif req.command == "panic":
        EngineWrapper.set_bot_state(False)
        # TODO: Add logic to close all trades immediately
    return {"status": "success", "command": req.command}

@router.get("/download-logs/")
def download_logs():
    log_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../logs/audit.log"))
    if os.path.exists(log_path):
        return FileResponse(log_path, media_type='application/text', filename="bot_audit_logs.txt")
    return {"error": "Log file not found"}
