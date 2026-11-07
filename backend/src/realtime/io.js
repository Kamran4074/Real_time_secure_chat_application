import { Server } from 'socket.io';
import { allowedOrigins } from '../config/urls.js';

// The Socket.IO server. Created here, attached to the HTTP server in server.js.
export const io = new Server({
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});
