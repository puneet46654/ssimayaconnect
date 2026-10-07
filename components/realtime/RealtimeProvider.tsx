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
import { clearFetchCache } from '@/lib/client-cache';

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
      // Drop cached reads first so listeners refetch fresh data.
      clearFetchCache();
      listenersRef.current.forEach((listener) =>
        listener(change),
      );
    };

    // Socket pushes are immediate; polling also covers disconnects and serverless deployments.
    let socket: Socket | undefined;
    if (process.env.NODE_ENV === 'development') {
      socket = io({
        autoConnect: true,
        transports: ['websocket'],
        reconnection: true,
        timeout: 2500,
      });
      socket.on('data.changed', handleChange);
    }

    // Poll the CDN-cached feed while visible, including when a socket connection is unavailable.
    let last: Record<string, number> | null = null;
    let stopped = false;
    let polling = false;
    const controller = new AbortController();

    const poll = async () => {
      if (stopped || polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        const response = await fetch('/api/realtime', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        const data = (await response.json()) as {
          versions?: Record<RealtimeChange['resource'], number>;
        };
        if (!response.ok || !data.versions || stopped) return;
        // The first poll only records versions: pages have just loaded their data themselves.
        for (const [resource, version] of Object.entries(data.versions)) {
          if (last && version !== last[resource]) {
            handleChange({
              resource: resource as RealtimeChange['resource'],
              action: 'updated',
            });
          }
        }
        last = data.versions;
      } catch {
        // Network hiccup: try again on the next tick.
      } finally { polling = false; }
    };

    void poll();
    const interval = window.setInterval(poll, 4000);
    document.addEventListener('visibilitychange', poll);

    return () => {
      stopped = true;
      controller.abort();
      socket?.off('data.changed', handleChange);
      socket?.disconnect();
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
