import type { Server as SocketIOServer } from 'socket.io';
import Ably from 'ably';

declare global {
  // Set by server.mjs when the application is running with Socket.IO.
  var realtimeIO: SocketIOServer | undefined;
}

export type RealtimeChange = {
  resource: 'events';
  action: 'created' | 'updated' | 'deleted';
  id?: string;
};

let ablyRest: Ably.Rest | null = null;

function getAblyRest() {
  const apiKey = process.env.ABLY_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  if (!ablyRest) {
    ablyRest = new Ably.Rest(apiKey);
  }

  return ablyRest;
}

export function emitRealtimeChange(change: RealtimeChange) {
  globalThis.realtimeIO?.emit('data.changed', change);

  const ably = getAblyRest();

  if (!ably) {
    return;
  }

  void ably.channels
    .get('ssimaya-events')
    .publish('data.changed', change)
    .catch((error: unknown) => {
      console.error(
        'Failed to publish realtime change to Ably:',
        error,
      );
    });
}
