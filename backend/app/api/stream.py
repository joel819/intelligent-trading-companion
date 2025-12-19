from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.stream_manager import stream_manager

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await stream_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, maybe receive commands (optional)
            await websocket.receive_text()
    except WebSocketDisconnect:
        stream_manager.disconnect(websocket)
