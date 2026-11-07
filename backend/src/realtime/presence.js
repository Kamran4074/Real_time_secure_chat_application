import { io } from './io.js';

// In-memory state of who is connected. Lost on restart; clients reconnect and rebuild it.

const onlineUsers = new Map(); // {userId -> number of open sockets (tabs)}
const offlineTimers = new Map(); // {userId -> pending "went offline" timer}
// {userId -> Set of user ids hidden from them}: people they blocked + people who blocked them.
// Kept for online users only, so online status and typing are filtered without a DB query per event.
const hiddenUsers = new Map();

// Debounced "offline": after the last tab closes, wait a moment before telling everyone.
// A page refresh reconnects within this time, so the user never flickers Online -> Offline -> Online.
const offlineDelayMs = ()=> Number(process.env.PRESENCE_GRACE_MS) || 3000;

// has at least one tab open right now (a user in the offline grace period has 0)
export const isOnline = (userId)=> (onlineUsers.get(userId.toString()) || 0) > 0;

export const isConnected = (userId)=> onlineUsers.has(userId.toString());

export const isHidden = (userId, otherId)=> Boolean(hiddenUsers.get(userId)?.has(otherId));

export const setHidden = (userId, ids)=> hiddenUsers.set(userId.toString(), ids);

// Everyone gets the online list, minus users hidden from them by a block
export const broadcastOnlineUsers = ()=>{
    const ids = [...onlineUsers.keys()];
    for(const id of ids){
        const hidden = hiddenUsers.get(id);
        io.to(id).emit('getOnlineUsers', hidden?.size ? ids.filter(other => !hidden.has(other)) : ids);
    }
};

// a socket of this user connected; returns the number of open sockets
export const addSocket = (userId)=>{
    // came back before the offline timer fired (e.g. a refresh): cancel it
    clearTimeout(offlineTimers.get(userId));
    offlineTimers.delete(userId);
    const count = (onlineUsers.get(userId) || 0) + 1;
    onlineUsers.set(userId, count);
    return count;
};

// a socket of this user closed. When it was the last one, onOffline(lastSeen) runs after the grace period
// (unless the user reconnected meanwhile). Returns the number of sockets still open.
export const removeSocket = (userId, onOffline)=>{
    const count = Math.max((onlineUsers.get(userId) || 1) - 1, 0);
    onlineUsers.set(userId, count); // other tabs still open, or 0 = offline soon
    if(count > 0) return count;

    const lastSeen = new Date(); // when they actually left, not when the grace period ends
    const timer = setTimeout(()=>{
        offlineTimers.delete(userId);
        if(onlineUsers.get(userId) !== 0) return; // reconnected meanwhile
        onlineUsers.delete(userId);
        hiddenUsers.delete(userId);
        onOffline(lastSeen);
    }, offlineDelayMs());
    timer.unref(); // never keeps the process alive on shutdown
    offlineTimers.set(userId, timer);
    return count;
};

export const onlineUserIds = ()=> [...onlineUsers.keys()];
