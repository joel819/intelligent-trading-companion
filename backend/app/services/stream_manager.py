from typing import List
from fastapi import WebSocket

class StreamManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_tick(self, tick_data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json({"type": "tick", "data": tick_data})
            except Exception:
                # Handle disconnection or error silently for now
                pass

    async def broadcast_log(self, log_entry: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json({"type": "log", "data": log_entry})
            except Exception:
                pass

# Global Instance
stream_manager = StreamManager()
