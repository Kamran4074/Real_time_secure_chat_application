import { io } from './io.js';
import hooks from './hooks.js';
import { isConnected, setHidden, broadcastOnlineUsers } from './presence.js';

// The only realtime API that modules use. Modules never import socket.io directly.

export { isOnline } from './presence.js';

// Each user joins a room named after their id, so all their tabs receive the event
export const emitToUser = (userId, event, data)=>{
    io.to(userId.toString()).emit(event, data);
};

// Kick out live sockets that were opened with a token that just got logged out
export const disconnectToken = async(userId, jti)=>{
    const sockets = await io.in(userId.toString()).fetchSockets();
    sockets.filter(s => s.data.jti === jti).forEach(s => s.disconnect(true));
};

// After a password change / reset / "log out everywhere": close every live socket of that user
export const disconnectUser = (userId)=>{
    io.in(userId.toString()).disconnectSockets(true);
};

// After a block / unblock: reload who is hidden from both users (if online) and resend online status
export const refreshBlocks = async(...userIds)=>{
    await Promise.all(userIds.map(async(id)=>{
        if(isConnected(id)) setHidden(id, await hooks.loadHiddenUserIds(id.toString()));
    }));
    broadcastOnlineUsers();
};
