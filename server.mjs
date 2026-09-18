import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV === 'development';
const hostname = process.env.HOSTNAME || 'localhost';
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((request, response) => {
  handle(request, response);
});

const io = new SocketIOServer(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

globalThis.realtimeIO = io;

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
