import { useEffect, useState } from 'react';
import type { LiveSnapshot } from '../../../shared/api/types';

export function useLiveRide(workoutId: string): { snapshot: LiveSnapshot | null; connected: boolean } {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/v1/live`);
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { type?: string; snapshot?: LiveSnapshot };
      if (message.type === 'snapshot' && message.snapshot?.workoutId === workoutId) {
        setSnapshot(message.snapshot);
      }
    };
    return () => {
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener('open', () => socket.close(), { once: true });
        return;
      }
      socket.close();
    };
  }, [workoutId]);

  return { snapshot, connected };
}
