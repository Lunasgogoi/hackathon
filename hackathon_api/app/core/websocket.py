from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Stores all active TCP connections
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Sends a JSON payload to every connected user"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # If a client disconnected ungracefully, ignore the error
                pass

# Create a single global instance
manager = ConnectionManager()