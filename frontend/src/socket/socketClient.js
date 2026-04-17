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
    transports: ['websocket'],
    auth: {
      token,
    },
  });
