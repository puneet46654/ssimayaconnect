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
    let knownEvents: Map<
      string,
      string
    > | null = null;
    let pollInFlight = false;

    const shouldUseSocket =
      process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true' ||
      (process.env.NODE_ENV === 'development' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

    const socket: Socket | null = shouldUseSocket
      ? io({
          autoConnect: true,
          transports: ['websocket'],
          reconnection: false,
          timeout: 2500,
        })
      : null;

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
        pollInFlight ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      pollInFlight = true;

      try {
        const response = await fetch(
          '/api/realtime',
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
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
      } finally {
        pollInFlight = false;
      }
    };

    if (socket) {
      socket.on('data.changed', handleChange);
    }

    void pollChanges();
    const fallbackTimer = window.setInterval(
      pollChanges,
      100,
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
      if (socket) {
        socket.off('data.changed', handleChange);
        socket.disconnect();
      }

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
