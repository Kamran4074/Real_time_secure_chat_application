import { z } from 'zod';
import { io } from './io.js';
import hooks, { setHooks } from './hooks.js';
import { addSocket, removeSocket, isHidden, setHidden, broadcastOnlineUsers, onlineUserIds } from './presence.js';
import { emitToUser } from './notifier.js';
import { objectId } from '../shared/validation.js';
import { socketEventLimiter } from '../shared/middleware/rateLimiters.js';
import logger, { errorMeta } from '../shared/logger.js';

// typing events must be exactly { receiverId: <ObjectId> }; anything else is ignored
const typingEventSchema = z.object({ receiverId: objectId() });

// Every socket must present a valid token; userId comes from the token, never from the client
const authenticateSocket = async(socket, next)=>{
    try {
        const session = await hooks.authenticate(socket.handshake.auth?.token);
        if(!session){
            logger.debug('Socket rejected: invalid token', {ip: socket.handshake.address});
            return next(new Error("Unauthorized"));
        }
        socket.userId = session.userId;
        socket.data.jti = session.jti;
        socket.data.hidden = await hooks.loadHiddenUserIds(session.userId);
        next();
    } catch (error) {
        logger.error('Socket auth failed', errorMeta(error));
        next(new Error("Unauthorized"));
    }
};

// Forward typing events to the receiver. Over the socket's rate limit, or across a block: dropped.
const forwardTyping = (socket, outgoingEvent)=> (payload)=>{
    if(!socket.data.allowEvent()) return;
    const result = typingEventSchema.safeParse(payload);
    if(!result.success || isHidden(socket.userId, result.data.receiverId)) return;
    emitToUser(result.data.receiverId, outgoingEvent, {senderId: socket.userId});
};

const userWentOffline = (userId)=> (lastSeen)=>{
    broadcastOnlineUsers();
    // everyone still online (except across a block) can show "last seen ..." right away
    for(const id of onlineUserIds()){
        if(!isHidden(id, userId)) emitToUser(id, 'lastSeen', {userId, at: lastSeen});
    }
    Promise.resolve().then(()=> hooks.onUserOffline(userId, lastSeen))
        .catch(error => logger.error('Going offline failed', {userId, ...errorMeta(error)}));
};

const onConnection = (socket)=>{
    const userId = socket.userId;
    socket.data.allowEvent = socketEventLimiter({limit: Number(process.env.SOCKET_EVENT_LIMIT) || 20, windowMs: 5000});
    socket.join(userId);
    const count = addSocket(userId);
    setHidden(userId, socket.data.hidden);
    broadcastOnlineUsers();
    Promise.resolve().then(()=> hooks.onUserOnline(userId))
        .catch(error => logger.error('Coming online failed', {userId, ...errorMeta(error)}));
    logger.debug('Socket connected', {userId, sockets: count});

    socket.on('typing', forwardTyping(socket, 'userTyping'));
    socket.on('stopTyping', forwardTyping(socket, 'userStoppedTyping'));

    socket.on('disconnect', (reason)=>{
        const left = removeSocket(userId, userWentOffline(userId));
        logger.debug('Socket disconnected', {userId, reason, sockets: left});
    });
};

// Attach Socket.IO to the HTTP server; `realtimeHooks` connect it to the business modules (see hooks.js)
export const setupRealtime = (server, realtimeHooks)=>{
    setHooks(realtimeHooks);
    io.attach(server);
    io.use(authenticateSocket);
    io.on('connection', onConnection);
    return io;
};
