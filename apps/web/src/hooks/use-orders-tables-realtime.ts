'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useOrdersTablesActions } from '../store';

export function useOrdersTablesRealtime(enabled: boolean) {
  const router = useRouter();
  const actions = useOrdersTablesActions();

  useEffect(() => {
    if (!enabled) return;

    let fallbackRefresh: ReturnType<typeof setInterval> | undefined;
    const startFallbackRefresh = () => {
      fallbackRefresh ??= setInterval(() => {
        if (document.visibilityState === 'visible') router.refresh();
      }, 5_000);
    };
    const stopFallbackRefresh = () => {
      if (fallbackRefresh) clearInterval(fallbackRefresh);
      fallbackRefresh = undefined;
    };

    const socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:3001', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: (callback) => {
        void fetch('/api/realtime-token', { cache: 'no-store' })
          .then(async (response) => {
            if (!response.ok) throw new Error('Realtime authentication failed');
            const result: unknown = await response.json();
            if (
              result === null ||
              typeof result !== 'object' ||
              !('token' in result) ||
              typeof result.token !== 'string'
            ) {
              throw new Error('Invalid realtime token response');
            }
            callback({ token: result.token });
          })
          .catch(() => callback({}));
      },
    });

    socket.on('connect', () => {
      actions.setRealtimeStatus('connected');
      stopFallbackRefresh();
      router.refresh();
    });
    socket.on('disconnect', () => {
      actions.setRealtimeStatus('reconnecting');
      startFallbackRefresh();
    });
    socket.on('connect_error', () => {
      actions.setRealtimeStatus('reconnecting');
      startFallbackRefresh();
    });
    socket.on('order:changed', () => router.refresh());
    startFallbackRefresh();
    socket.connect();

    return () => {
      stopFallbackRefresh();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [actions, enabled, router]);
}
