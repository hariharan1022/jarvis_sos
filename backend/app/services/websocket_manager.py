from fastapi import WebSocket
from typing import Dict, List, Set

class ConnectionManager:
    def __init__(self):
        # Maps tracking_code -> List of WebSockets (guardians listening)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # List of WebSockets connected as general administrators
        self.admin_connections: Set[WebSocket] = set()

    async def connect_session(self, tracking_code: str, websocket: WebSocket):
        await websocket.accept()
        if tracking_code not in self.active_connections:
            self.active_connections[tracking_code] = set()
        self.active_connections[tracking_code].add(websocket)

    def disconnect_session(self, tracking_code: str, websocket: WebSocket):
        if tracking_code in self.active_connections:
            self.active_connections[tracking_code].remove(websocket)
            if not self.active_connections[tracking_code]:
                del self.active_connections[tracking_code]

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.add(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        self.admin_connections.discard(websocket)

    async def broadcast_to_session(self, tracking_code: str, message: dict):
        # Broadcast to guardians of this session
        if tracking_code in self.active_connections:
            for connection in list(self.active_connections[tracking_code]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect_session(tracking_code, connection)
        
        # Also broadcast to all connected admins
        await self.broadcast_to_admins({
            "type": "emergency_update",
            "tracking_code": tracking_code,
            "data": message
        })

    async def broadcast_to_admins(self, message: dict):
        for connection in list(self.admin_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect_admin(connection)

manager = ConnectionManager()
