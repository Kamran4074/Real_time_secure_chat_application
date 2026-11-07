import { useEffect, useRef } from 'react';
import { useSocketContext } from './SocketContext';

// Subscribe to a socket event for the lifetime of the component.
// The handler may change every render; the subscription doesn't (it always calls the latest handler),
// and only this handler is removed on cleanup (other components' listeners stay).
const useSocketEvent = (event, handler) => {
    const { socket } = useSocketContext();
    const latest = useRef(handler);
    useEffect(() => { latest.current = handler; });

    useEffect(() => {
        if (!socket) return;
        const listener = (payload) => latest.current(payload);
        socket.on(event, listener);
        return () => socket.off(event, listener);
    }, [socket, event]);
};

export default useSocketEvent;
