import asyncio
from typing import List, Dict
from fastapi import WebSocket

class StreamManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.sse_queues: List[asyncio.Queue] = []
        self.log_history: List[Dict] = []
        self.max_history = 100

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def subscribe_sse(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.sse_queues.append(queue)
        return queue

    def unsubscribe_sse(self, queue: asyncio.Queue):
        if queue in self.sse_queues:
            self.sse_queues.remove(queue)

    async def _broadcast(self, message: dict):
        # Broadcast to WebSockets
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass
        
        # Broadcast to SSE Queues
        for queue in self.sse_queues:
            try:
                await queue.put(message)
            except Exception as e:
                print(f"Broadcast Error (Queue): {e}")

    async def broadcast_tick(self, tick_data: dict):
        await self._broadcast({"type": "tick", "data": tick_data})

    async def broadcast_log(self, log_entry: dict):
        # Store in history
        self.log_history.append(log_entry)
        if len(self.log_history) > self.max_history:
            self.log_history.pop(0)
            
        await self._broadcast({"type": "log", "data": log_entry})

    async def broadcast_event(self, event_type: str, data: dict):
        await self._broadcast({"type": event_type, "data": data})

# Global Instance
stream_manager = StreamManager()
