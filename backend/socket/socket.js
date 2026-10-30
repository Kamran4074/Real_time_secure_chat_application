import {Server} from 'socket.io';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const app = express();

const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin:['http://localhost:5173', 'https://chatwave-azure.vercel.app'],
        methods:["GET","POST"]
    }
});

const onlineUsers = new Map(); //{userId -> number of open sockets (tabs)}

// Every socket must present a valid JWT; userId comes from the token, never from the client
io.use((socket, next)=>{
    try {
        const token = socket.handshake.auth?.token;
        if(!token) return next(new Error("Unauthorized"));
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decode.userId.toString();
        next();
    } catch (error) {
        next(new Error("Unauthorized"));
    }
});

// Each user joins a room named after their id, so all their tabs receive messages
export const emitToUser = (userId, event, data)=>{
    io.to(userId.toString()).emit(event, data);
};

const isValidId = (id)=> typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

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
