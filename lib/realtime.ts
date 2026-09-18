import type { Server as SocketIOServer } from 'socket.io';

declare global {
  // Set by server.mjs when the application is running with Socket.IO.
  var realtimeIO: SocketIOServer | undefined;
}

export type RealtimeChange = {
  resource: 'events';
  action: 'created' | 'updated' | 'deleted';
  id?: string;
};

export function emitRealtimeChange(change: RealtimeChange) {
  globalThis.realtimeIO?.emit('data.changed', change);
}
