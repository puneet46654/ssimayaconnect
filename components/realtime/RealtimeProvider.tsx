'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import type { RealtimeChange } from '@/lib/realtime';

type RealtimeContextValue = {
  subscribe: (
    listener: (change: RealtimeChange) => void,
  ) => () => void;
};

const RealtimeContext =
  createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const listenersRef = useRef(
    new Set<(change: RealtimeChange) => void>(),
  );

  useEffect(() => {
    const handleChange = (change: RealtimeChange) => {
      listenersRef.current.forEach((listener) =>
        listener(change),
      );
    };

    // Local dev runs server.mjs with Socket.IO for instant pushes.
    if (process.env.NODE_ENV === 'development') {
      const socket: Socket = io({
        autoConnect: true,
        transports: ['websocket'],
        reconnection: false,
        timeout: 2500,
      });
      socket.on('data.changed', handleChange);
      return () => {
        socket.off('data.changed', handleChange);
        socket.disconnect();
      };
    }

    // Production (Vercel): poll the CDN-cached change feed while the tab is visible.
    let last: Record<string, number> | null = null;
    let stopped = false;

    const poll = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/realtime');
        const data = (await response.json()) as {
          versions?: Record<RealtimeChange['resource'], number>;
        };
        if (!data.versions || stopped) return;
        if (last) {
          for (const [resource, version] of Object.entries(data.versions)) {
            if (version !== last[resource]) {
              handleChange({
                resource: resource as RealtimeChange['resource'],
                action: 'updated',
              });
            }
          }
        }
        last = data.versions;
      } catch {
        // Network hiccup: try again on the next tick.
      }
    };

    void poll();
    const interval = window.setInterval(poll, 4000);
    document.addEventListener('visibilitychange', poll);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    [],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeRefresh(
  resource: RealtimeChange['resource'],
  refresh: (change: RealtimeChange) => void,
) {
  const context = useContext(RealtimeContext);

  useEffect(() => {
    if (!context) return;

    return context.subscribe((change) => {
      if (change.resource === resource) {
        refresh(change);
      }
    });
  }, [context, refresh, resource]);
}
