import {Server} from 'socket.io';
import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwtwebTokens.js';
import allowedOrigins from '../utils/allowedOrigins.js';

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

const isValidId =(id)=> typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

io.on('connection',(socket)=>{
    const userId = socket.userId;

    socket.join(userId);
    onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
    io.emit("getOnlineUsers",[...onlineUsers.keys()])

    // Typing indicator events
    socket.on('typing', ({receiverId} = {}) => {
        if(isValidId(receiverId)) emitToUser(receiverId, 'userTyping', {senderId: userId});
    });

    socket.on('stopTyping', ({receiverId} = {}) => {
        if(isValidId(receiverId)) emitToUser(receiverId, 'userStoppedTyping', {senderId: userId});
    });

    socket.on('disconnect',()=>{
        const count = (onlineUsers.get(userId) || 1) - 1;
        if(count <= 0) onlineUsers.delete(userId);
        else onlineUsers.set(userId, count);
        io.emit('getOnlineUsers',[...onlineUsers.keys()])
    });
});

export {app , io , server}
