'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Ably from 'ably';
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
    const useAbly =
      process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true';

    const socket: Socket | null = !useAbly &&
      process.env.NODE_ENV === 'development'
      ? io({
          autoConnect: true,
          transports: ['websocket'],
          reconnection: false,
          timeout: 2500,
        })
      : null;
    const ably = useAbly
      ? new Ably.Realtime({
          authUrl: '/api/realtime/token',
          authMethod: 'POST',
          transports: ['web_socket'],
        })
      : null;
    const channel = ably?.channels.get('ssimaya-events');

    const handleChange = (change: RealtimeChange) => {
      listenersRef.current.forEach((listener) =>
        listener(change),
      );
    };

    if (socket) {
      socket.on('data.changed', handleChange);
    }

    if (channel) {
      channel.subscribe('data.changed', (message) => {
        if (message.data && typeof message.data === 'object') {
          handleChange(message.data as RealtimeChange);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('data.changed', handleChange);
        socket.disconnect();
      }

      if (channel) {
        void channel.unsubscribe();
      }

      if (ably) {
        ably.close();
      }
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
