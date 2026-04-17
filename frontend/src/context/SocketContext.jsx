import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSocketClient } from '../socket/socketClient';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const buildEvent = (name, payload) => ({
  id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  payload,
  timestamp: new Date().toISOString(),
});

export function SocketProvider({ children }) {
  const { session } = useAuth();
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [events, setEvents] = useState([]);
  const [latestRideEvent, setLatestRideEvent] = useState(null);

  useEffect(() => {
    const socket = socketRef.current;

    if (socket) {
      socket.disconnect();
      socketRef.current = null;
    }

    if (!session?.token || !session?.role) {
      setConnectionStatus('idle');
      return undefined;
    }

    const nextSocket = createSocketClient({
      token: session.token,
    });

    socketRef.current = nextSocket;
    setConnectionStatus('connecting');

    const pushEvent = (name, payload) => {
      setEvents((current) => [buildEvent(name, payload), ...current].slice(0, 20));
    };

    nextSocket.on('connect', () => {
      setConnectionStatus('connected');
      pushEvent('socket-connected', { socketId: nextSocket.id });
    });

    nextSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      pushEvent('socket-disconnected', { socketId: nextSocket.id });
    });

    nextSocket.on('registered', (payload) => {
      pushEvent('socket-registered', payload);
    });

    nextSocket.on('socket-error', (payload) => {
      pushEvent('socket-error', payload);
    });

    nextSocket.on('driver-location-updated', (payload) => {
      pushEvent('driver-location-updated', payload);
    });

    nextSocket.on('ride-requested', (payload) => {
      setLatestRideEvent({ type: 'ride-requested', payload });
      pushEvent('ride-requested', payload);
    });

    nextSocket.on('ride-accepted', (payload) => {
      setLatestRideEvent({ type: 'ride-accepted', payload });
      pushEvent('ride-accepted', payload);
    });

    nextSocket.on('ride-started', (payload) => {
      setLatestRideEvent({ type: 'ride-started', payload });
      pushEvent('ride-started', payload);
    });

    nextSocket.on('ride-completed', (payload) => {
      setLatestRideEvent({ type: 'ride-completed', payload });
      pushEvent('ride-completed', payload);
    });

    nextSocket.on('ride-status-updated', (payload) => {
      setLatestRideEvent({ type: 'ride-status-updated', payload });
      pushEvent('ride-status-updated', payload);
    });

    return () => {
      nextSocket.removeAllListeners();
      nextSocket.disconnect();
      socketRef.current = null;
    };
  }, [session?.role, session?.token]);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      connectionStatus,
      isConnected: connectionStatus === 'connected',
      events,
      latestRideEvent,
    }),
    [connectionStatus, events, latestRideEvent]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
