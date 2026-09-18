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
    let socketConnected = false;
    let knownEvents: Map<
      string,
      string
    > | null = null;

    const socket: Socket = io({
      autoConnect: true,
      transports: ['websocket'],
      reconnection: false,
      timeout: 2500,
    });

    const handleChange = (change: RealtimeChange) => {
      listenersRef.current.forEach((listener) =>
        listener(change),
      );
    };

    const notify = (change: RealtimeChange) => {
      listenersRef.current.forEach((listener) =>
        listener(change),
      );
    };

    const pollChanges = async () => {
      if (
        socketConnected ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      try {
        const response = await fetch(
          '/api/realtime',
          {
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json() as {
          success?: boolean;
          events?: Array<{
            id: string;
            updatedAt: string;
            status: string;
          }>;
        };

        if (!data.success || !Array.isArray(data.events)) {
          return;
        }

        const nextEvents = new Map(
          data.events.map((event) => [
            event.id,
            `${event.updatedAt}:${event.status}`,
          ]),
        );

        if (knownEvents) {
          nextEvents.forEach((version, id) => {
            const previousVersion = knownEvents?.get(id);

            if (!previousVersion) {
              notify({
                resource: 'events',
                action: 'created',
                id,
              });
            } else if (previousVersion !== version) {
              notify({
                resource: 'events',
                action: 'updated',
                id,
              });
            }
          });

          knownEvents.forEach((_version, id) => {
            if (!nextEvents.has(id)) {
              notify({
                resource: 'events',
                action: 'deleted',
                id,
              });
            }
          });
        }

        knownEvents = nextEvents;
      } catch (error) {
        console.error(
          'Realtime fallback poll failed:',
          error,
        );
      }
    };

    const handleConnect = () => {
      socketConnected = true;
    };

    const handleDisconnect = () => {
      socketConnected = false;
    };

    socket.on('data.changed', handleChange);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    void pollChanges();
    const fallbackTimer = window.setInterval(
      pollChanges,
      5000,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pollChanges();
      }
    };
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      socket.off('data.changed', handleChange);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      window.clearInterval(fallbackTimer);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
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
