from fastapi import APIRouter
from app.services.stream_manager import stream_manager

router = APIRouter()

@router.get("/")
async def get_logs():
    """Returns the last 100 log entries from the in-memory buffer."""
    return stream_manager.log_history
