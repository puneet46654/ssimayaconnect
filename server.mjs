import cluster from 'node:cluster';
import { createServer } from 'node:http';
import { availableParallelism } from 'node:os';
import next from 'next';
import { createClient } from 'redis';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV === 'development';
const hostname = process.env.HOSTNAME || 'localhost';
const port = Number(process.env.PORT || 3000);
// One worker per CPU in production; a single process in development.
const workers = Math.max(1, Number(process.env.CLUSTER_WORKERS) || (dev ? 1 : availableParallelism()));
const redisUrl = process.env.REDIS_URL;
const REDIS_CHANNEL = 'ssimaya:realtime';

if (workers > 1 && cluster.isPrimary) {
  console.log(`> Primary ${process.pid} starting ${workers} workers`);
  for (let i = 0; i < workers; i += 1) cluster.fork();

  // Without Redis, the primary relays realtime changes between its workers.
  cluster.on('message', (_worker, message) => {
    if (message?.type !== 'realtime') return;
    for (const worker of Object.values(cluster.workers)) worker?.send(message);
  });

  cluster.on('exit', (worker, code, signal) => {
    console.error(`> Worker ${worker.process.pid} exited (${signal || code}); restarting`);
    cluster.fork();
  });
} else {
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

  // Apply a change made by any worker or server to this process.
  const applyChange = (change) => {
    globalThis.eventsListCache = undefined;
    io.emit('data.changed', change);
  };

  if (redisUrl) {
    // Shared across machines behind the load balancer.
    const publisher = createClient({ url: redisUrl });
    const subscriber = publisher.duplicate();
    for (const client of [publisher, subscriber]) {
      client.on('error', (error) => console.error('Redis error:', error));
    }
    await Promise.all([publisher.connect(), subscriber.connect()]);
    await subscriber.subscribe(REDIS_CHANNEL, (raw) => applyChange(JSON.parse(raw)));
    globalThis.realtimeBroadcast = (change) => {
      publisher.publish(REDIS_CHANNEL, JSON.stringify(change)).catch((error) => {
        console.error('Failed to publish realtime change:', error);
        applyChange(change);
      });
    };
  } else if (cluster.isWorker) {
    process.on('message', (message) => {
      if (message?.type === 'realtime') applyChange(message.change);
    });
    globalThis.realtimeBroadcast = (change) => process.send?.({ type: 'realtime', change });
  }

  httpServer.listen(port, hostname, () => {
    const worker = cluster.isWorker ? ` (worker ${process.pid})` : '';
    console.log(`> Ready on http://${hostname}:${port}${worker}`);
  });
}
