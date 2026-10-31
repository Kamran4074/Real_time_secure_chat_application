import {Server} from 'socket.io';
import http from 'http';
import express from 'express';
import { verifyToken, isTokenError } from '../utils/jwt.js';
import allowedOrigins from '../utils/allowedOrigins.js';
import { typingEventSchema } from '../validation/schemas.js';
import logger, { errorMeta } from '../utils/logger.js';
import { socketEventLimiter } from '../middleware/rateLimiters.js';

const app = express();

const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin:allowedOrigins,
        methods:["GET","POST"]
    }
});

const onlineUsers = new Map(); //{userId -> number of open sockets (tabs)}

// Every socket must present a valid JWT; userId comes from the token, never from the client
io.use(async(socket, next)=>{
    try {
        const token = socket.handshake.auth?.token;
        if(!token) return next(new Error("Unauthorized"));
        const decode = await verifyToken(token);
        socket.userId = decode.userId.toString();
        socket.data.jti = decode.jti;
        next();
    } catch (error) {
        if(isTokenError(error)) logger.debug('Socket rejected: invalid token', {ip: socket.handshake.address});
        else logger.error('Socket auth failed', errorMeta(error));
        next(new Error("Unauthorized"));
    }
});

// Each user joins a room named after their id, so all their tabs receive messages
export const emitToUser = (userId, event, data)=>{
    io.to(userId.toString()).emit(event, data);
};

// Kick out live sockets that were opened with a token that just got logged out
export const disconnectToken = async(userId, jti)=>{
    const sockets = await io.in(userId.toString()).fetchSockets();
    sockets.filter(s => s.data.jti === jti).forEach(s => s.disconnect(true));
};

// Forward typing events only when the payload is { receiverId: <ObjectId> }; ignore anything else.
// Events over the socket's rate limit are dropped, so one client can't flood another.
const forwardTyping = (socket, outgoingEvent)=> (payload)=>{
    if(!socket.data.allowEvent()) return;
    const result = typingEventSchema.safeParse(payload);
    if(!result.success) return;
    emitToUser(result.data.receiverId, outgoingEvent, {senderId: socket.userId});
};

io.on('connection',(socket)=>{
    const userId = socket.userId;

    socket.data.allowEvent = socketEventLimiter({limit: Number(process.env.SOCKET_EVENT_LIMIT) || 20, windowMs: 5000});
    socket.join(userId);
    onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
    io.emit("getOnlineUsers",[...onlineUsers.keys()])
    logger.debug('Socket connected', {userId, sockets: onlineUsers.get(userId)});

    // Typing indicator events
    socket.on('typing', forwardTyping(socket, 'userTyping'));
    socket.on('stopTyping', forwardTyping(socket, 'userStoppedTyping'));

    socket.on('disconnect',(reason)=>{
        const count = (onlineUsers.get(userId) || 1) - 1;
        if(count <= 0) onlineUsers.delete(userId);
        else onlineUsers.set(userId, count);
        io.emit('getOnlineUsers',[...onlineUsers.keys()])
        logger.debug('Socket disconnected', {userId, reason});
    });
});

export {app , io , server}
