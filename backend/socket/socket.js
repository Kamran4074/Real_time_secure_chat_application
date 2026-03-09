import {Server} from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();

const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin:['http://localhost:5173'],
        methods:["GET","POST"]
    }
});

export const getReceiverSocketId = (receiverId)=>{
    return userSocketmap[receiverId];
};

const userSocketmap={}; //{userId,socketId}
io.on('connection',(socket)=>{
    const userId = socket.handshake.query.userId;

    if(userId !== "undefined") userSocketmap[userId] = socket.id;
    io.emit("getOnlineUsers",Object.keys(userSocketmap))

    // Typing indicator events
    socket.on('typing', ({receiverId}) => {
        const receiverSocketId = userSocketmap[receiverId];
        if(receiverSocketId){
            io.to(receiverSocketId).emit('userTyping', {senderId: userId});
        }
    });

    socket.on('stopTyping', ({receiverId}) => {
        const receiverSocketId = userSocketmap[receiverId];
        if(receiverSocketId){
            io.to(receiverSocketId).emit('userStoppedTyping', {senderId: userId});
        }
    });

    socket.on('disconnect',()=>{
        delete userSocketmap[userId];
        io.emit('getOnlineUsers',Object.keys(userSocketmap))
    });
});

export {app , io , server}