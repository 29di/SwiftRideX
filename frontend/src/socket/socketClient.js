import { io } from 'socket.io-client';

const resolveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }

  return 'http://localhost:5000';
};

export const createSocketClient = ({ token }) =>
  io(resolveSocketUrl(), {
    autoConnect: true,
    // Start with polling so Render cold-start/proxy edge cases can recover,
    // then upgrade to websocket automatically when available.
    transports: ['polling', 'websocket'],
    upgrade: true,
    timeout: 30000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: {
      token,
    },
  });
