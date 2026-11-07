import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketContext } from '../../../shared/realtime/SocketContext';
import useSocketEvent from '../../../shared/realtime/useSocketEvent';

const STOP_AFTER_MS = 2000; // "stopTyping" once there's been no key for this long

// Typing indicator both ways for the open chat:
//  - isTyping: the other person is typing to me
//  - onInput / stopTyping: tell them I'm typing (one "typing" per burst, not per keystroke)
const useTyping = (otherId) => {
    const { socket } = useSocketContext();
    const [isTyping, setIsTyping] = useState(false);
    const timeoutRef = useRef(null);
    const sentRef = useRef(false); // "typing" already told for this burst of keystrokes

    useSocketEvent('userTyping', ({ senderId }) => {
        if (senderId === otherId) setIsTyping(true);
    });
    useSocketEvent('userStoppedTyping', ({ senderId }) => {
        if (senderId === otherId) setIsTyping(false);
    });

    // switching chats (or leaving) mid-typing: tell the previous person right away
    useEffect(() => {
        setIsTyping(false);
        const timeout = timeoutRef;
        const sent = sentRef;
        return () => {
            clearTimeout(timeout.current);
            if (sent.current && otherId) socket?.emit('stopTyping', { receiverId: otherId });
            sent.current = false;
        };
    }, [otherId, socket]);

    // end the current burst (if any) and tell the other side once
    const stopTyping = useCallback(() => {
        clearTimeout(timeoutRef.current);
        if (sentRef.current) socket?.emit('stopTyping', { receiverId: otherId });
        sentRef.current = false;
    }, [socket, otherId]);

    const onInput = (value) => {
        if (!value.length || !otherId) return;
        if (!sentRef.current) {
            socket?.emit('typing', { receiverId: otherId });
            sentRef.current = true;
        }
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(stopTyping, STOP_AFTER_MS);
    };

    const clearTyping = useCallback(() => setIsTyping(false), []);

    return { isTyping, clearTyping, onInput, stopTyping };
};

export default useTyping;
