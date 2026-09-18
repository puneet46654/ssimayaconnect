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
    const socket: Socket = io({
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    const handleChange = (change: RealtimeChange) => {
      listenersRef.current.forEach((listener) =>
        listener(change),
      );
    };

    socket.on('data.changed', handleChange);

    return () => {
      socket.off('data.changed', handleChange);
      socket.disconnect();
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
