import {Server} from 'socket.io';
import http from 'http';
import express from 'express';
import { verifyToken, isTokenError, isSessionRevoked, SESSION_FIELDS } from '../utils/jwt.js';
import User from '../models/userModel.js';
import Message from '../models/messageModel.js';
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

// Debounced "offline": after the last tab closes, wait a moment before telling everyone.
// A page refresh reconnects within this time, so the user never flickers Online -> Offline -> Online.
const offlineDelayMs = ()=> Number(process.env.PRESENCE_GRACE_MS) || 3000;
const offlineTimers = new Map(); //{userId -> pending "went offline" timer}

// {userId -> Set of user ids hidden from them}: people they blocked + people who blocked them.
// Kept in memory for online users only, so online status and typing are filtered without a DB query per event.
const hiddenUsers = new Map();

const loadHiddenUsers = async(userId)=>{
    const [me, blockers] = await Promise.all([
        User.findById(userId).select('blockedUsers'),
        User.find({blockedUsers:userId}).select('_id')
    ]);
    return new Set([...(me?.blockedUsers || []), ...blockers.map(u => u._id)].map(String));
};

// has at least one tab open right now (a user in the offline grace period has 0)
export const isOnline = (userId)=> (onlineUsers.get(userId.toString()) || 0) > 0;

const isHidden = (userId, otherId)=> Boolean(hiddenUsers.get(userId)?.has(otherId));

// Everyone gets the online list, minus users hidden from them by a block
const broadcastOnlineUsers = ()=>{
    const ids = [...onlineUsers.keys()];
    for(const id of ids){
        const hidden = hiddenUsers.get(id);
        io.to(id).emit('getOnlineUsers', hidden?.size ? ids.filter(other => !hidden.has(other)) : ids);
    }
};

// Every socket must present a valid JWT; userId comes from the token, never from the client
io.use(async(socket, next)=>{
    try {
        const token = socket.handshake.auth?.token;
        if(!token) return next(new Error("Unauthorized"));
        const decode = await verifyToken(token);
        const user = await User.findById(decode.userId).select(SESSION_FIELDS);
        if(!user || isSessionRevoked(decode, user)) return next(new Error("Unauthorized"));
        socket.userId = decode.userId.toString();
        socket.data.jti = decode.jti;
        socket.data.hidden = await loadHiddenUsers(socket.userId);
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

// A user just connected: messages that waited for them are now delivered; tell each sender (✓ -> ✓✓)
const markDelivered = async(userId)=>{
    const senders = await Message.find({recieverId: userId, deliveredAt: null}).distinct('senderId');
    if(senders.length === 0) return;
    const at = new Date();
    await Message.updateMany({recieverId: userId, deliveredAt: null}, {deliveredAt: at});
    senders.forEach(senderId => emitToUser(senderId, 'messagesDelivered', {receiverId: userId, at}));
};

// Kick out live sockets that were opened with a token that just got logged out
export const disconnectToken = async(userId, jti)=>{
    const sockets = await io.in(userId.toString()).fetchSockets();
    sockets.filter(s => s.data.jti === jti).forEach(s => s.disconnect(true));
};

// After a password reset / "log out everywhere": close every live socket of that user (they reconnect only with a new token)
export const disconnectUser = (userId)=>{
    io.in(userId.toString()).disconnectSockets(true);
};

// After a block / unblock: reload who is hidden from both users (if online) and resend online status
export const refreshBlocks = async(...userIds)=>{
    await Promise.all(userIds.map(async(id)=>{
        const key = id.toString();
        if(onlineUsers.has(key)) hiddenUsers.set(key, await loadHiddenUsers(key));
    }));
    broadcastOnlineUsers();
};

// Forward typing events only when the payload is { receiverId: <ObjectId> }; ignore anything else.
// Events over the socket's rate limit, or between users where one blocked the other, are dropped.
const forwardTyping = (socket, outgoingEvent)=> (payload)=>{
    if(!socket.data.allowEvent()) return;
    const result = typingEventSchema.safeParse(payload);
    if(!result.success || isHidden(socket.userId, result.data.receiverId)) return;
    emitToUser(result.data.receiverId, outgoingEvent, {senderId: socket.userId});
};

io.on('connection',(socket)=>{
    const userId = socket.userId;

    socket.data.allowEvent = socketEventLimiter({limit: Number(process.env.SOCKET_EVENT_LIMIT) || 20, windowMs: 5000});
    socket.join(userId);
    // came back before the offline timer fired (e.g. a refresh): cancel it
    clearTimeout(offlineTimers.get(userId));
    offlineTimers.delete(userId);
    onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
    hiddenUsers.set(userId, socket.data.hidden);
    broadcastOnlineUsers();
    markDelivered(userId).catch(error => logger.error('Marking messages delivered failed', {userId, ...errorMeta(error)}));
    logger.debug('Socket connected', {userId, sockets: onlineUsers.get(userId)});

    // Typing indicator events
    socket.on('typing', forwardTyping(socket, 'userTyping'));
    socket.on('stopTyping', forwardTyping(socket, 'userStoppedTyping'));

    socket.on('disconnect',(reason)=>{
        const count = Math.max((onlineUsers.get(userId) || 1) - 1, 0);
        onlineUsers.set(userId, count); // other tabs still open, or 0 = offline soon
        logger.debug('Socket disconnected', {userId, reason, sockets: count});
        if(count > 0) return; // still online in another tab: nothing changed for anyone

        const lastSeen = new Date(); // when they actually left, not when the grace period ends
        const timer = setTimeout(()=>{
            offlineTimers.delete(userId);
            if(onlineUsers.get(userId) !== 0) return; // reconnected meanwhile
            onlineUsers.delete(userId);
            hiddenUsers.delete(userId);
            broadcastOnlineUsers();
            // everyone still online (except across a block) can show "last seen ..." right away
            for(const id of onlineUsers.keys()){
                if(!isHidden(id, userId)) io.to(id).emit('lastSeen', {userId, at: lastSeen});
            }
            User.updateOne({_id: userId}, {lastSeen})
                .catch(error => logger.error('Saving last seen failed', {userId, ...errorMeta(error)}));
        }, offlineDelayMs());
        timer.unref(); // never keeps the process alive on shutdown
        offlineTimers.set(userId, timer);
    });
});

export {app , io , server}
