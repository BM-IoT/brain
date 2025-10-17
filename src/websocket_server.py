import asyncio
import websockets

class WebSocketServer:
    def __init__(self, host="0.0.0.0", port=8765):
        self.host = host
        self.port = port
        self.on_message = None  # Should be set to a function(client, message)
        self._clients = set()
        self._loop = None

    async def _handler(self, websocket):
        self._clients.add(websocket)
        try:
            async for message in websocket:
                if self.on_message:
                    self.on_message(websocket, message)
        finally:
            self._clients.remove(websocket)

    def send(self, client, message):
        if self._loop and not self._loop.is_closed():
            asyncio.run_coroutine_threadsafe(client.send(message), self._loop)

    def broadcast(self, message):
        # Send a message to all connected clients
        if self._loop and not self._loop.is_closed():
            for client in list(self._clients):
                asyncio.run_coroutine_threadsafe(client.send(message), self._loop)

    async def _run_server(self):
        async with websockets.serve(self._handler, self.host, self.port):
            await asyncio.Future()  # run forever

    def run(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._run_server())
