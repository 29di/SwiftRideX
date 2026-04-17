import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export function createRiderSocket({ token } = {}) {
  return io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'],
    auth: {
      token,
    },
  });
}
