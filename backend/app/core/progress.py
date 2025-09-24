from __future__ import annotations

import asyncio
import json

from fastapi import WebSocket


class ProgressManager:
    """In-memory WebSocket progress broadcaster keyed by upload_id."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._channels: dict[str, set[WebSocket]] = {}

    async def connect(self, upload_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if upload_id not in self._channels:
                self._channels[upload_id] = set()
            self._channels[upload_id].add(websocket)

    async def disconnect(self, upload_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._channels.get(upload_id)
            if sockets and websocket in sockets:
                sockets.remove(websocket)
            if sockets and len(sockets) == 0:
                self._channels.pop(upload_id, None)

    async def send_progress(self, upload_id: str, stage: str, progress: int) -> None:
        payload = json.dumps({"type": "progress", "stage": stage, "progress": progress})
        async with self._lock:
            sockets = list(self._channels.get(upload_id, set()))
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                # Best-effort; cleanup on failure
                await self.disconnect(upload_id, ws)


progress_manager = ProgressManager()
