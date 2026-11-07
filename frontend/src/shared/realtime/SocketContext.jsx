import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { BACKEND_URL } from '../api/client';

const SocketContext = createContext();

export const useSocketContext = () => useContext(SocketContext);

// One Socket.IO connection per session token. The server verifies the token and takes the userId from it.
export const SocketContextProvider = ({ token, children }) => {
    const [socket, setSocket] = useState(null);
    const [onlineUser, setOnlineUser] = useState([]);
    const [lastSeen, setLastSeen] = useState({}); // {userId -> when they went offline, while this tab is open}

    useEffect(() => {
        if (!token) {
            setSocket(null);
            setOnlineUser([]);
            return;
        }
        const newSocket = io(BACKEND_URL, { auth: { token } });
        newSocket.on('getOnlineUsers', (users) => setOnlineUser(users));
        newSocket.on('lastSeen', ({ userId, at }) => setLastSeen((seen) => ({ ...seen, [userId]: at })));
        setSocket(newSocket);
        return () => newSocket.close();
    // only the token matters: editing the profile must not reconnect the socket
    }, [token]);

    return (
        <SocketContext.Provider value={{ socket, onlineUser, lastSeen }}>
            {children}
        </SocketContext.Provider>
    );
};
