import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from sse_starlette.sse import EventSourceResponse
from app.services.stream_manager import stream_manager

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await stream_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        stream_manager.disconnect(websocket)

@router.get("/feed/")
async def sse_feed(request: Request):
    print("SSE Client Connecting to /feed/")
    async def event_generator():
        queue = await stream_manager.subscribe_sse()
        try:
            while True:
                if await request.is_disconnected():
                    break
                data = await queue.get()
                yield {
                    "data": json.dumps(data)
                }
        finally:
            stream_manager.unsubscribe_sse(queue)

    return EventSourceResponse(event_generator())
