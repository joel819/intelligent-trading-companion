import asyncio
from typing import List, Dict
from fastapi import WebSocket

class StreamManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.sse_queues: List[asyncio.Queue] = []
        self.log_history: List[Dict] = []
        self.max_history = 100
        self.keep_alive_task = None

    async def _heartbeat_loop(self):
        """Send a ping every 30 seconds to keep connections alive."""
        while True:
            await asyncio.sleep(30)
            if self.active_connections:
                await self._broadcast({"type": "ping", "data": {"ts": "keep_alive"}})

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        client_host = websocket.client.host if websocket.client else "unknown"
        client_port = websocket.client.port if websocket.client else "unknown"
        print(f">>> [WS CONNECT] Client: {client_host}:{client_port} | Total: {len(self.active_connections) + 1}")
        self.active_connections.append(websocket)
        
        # Start heartbeat if not running
        if self.keep_alive_task is None:
            print(">>> [WS] Starting heartbeat loop...")
            self.keep_alive_task = asyncio.create_task(self._heartbeat_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            client_host = websocket.client.host if websocket.client else "unknown"
            client_port = websocket.client.port if websocket.client else "unknown"
            print(f">>> [WS DISCONNECT] Client: {client_host}:{client_port} | Remaining: {len(self.active_connections) - 1}")
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
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                client_host = connection.client.host if hasattr(connection, 'client') and connection.client else "unknown"
                print(f">>> [WS BROADCAST ERROR] Client {client_host}: {e}")
                dead_connections.append(connection)
        
        for dead in dead_connections:
            if dead in self.active_connections:
                self.active_connections.remove(dead)
        
        # Broadcast to SSE Queues
        for queue in self.sse_queues:
            try:
                await queue.put(message)
            except Exception as e:
                print(f">>> [SSE BROADCAST ERROR]: {e}")

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

    async def broadcast_skipped_signal(self, data: dict):
        """Broadcast a skipped signal event."""
        await self._broadcast({"type": "signal_skipped", "data": data})

    async def broadcast_notification(self, title: str, body: str, level: str = "info"):
        """Broadcast a system notification to the frontend."""
        await self._broadcast({
            "type": "notification",
            "data": {
                "title": title,
                "body": body,
                "level": level
            }
        })

# Global Instance
stream_manager = StreamManager()
