import { useCallback, useEffect, useState } from 'react';
import useConversation from '../../../shared/store/useConversation';
import useSocketEvent from '../../../shared/realtime/useSocketEvent';
import logger from '../../../shared/lib/logger';
import { getRecentChats, getBlockedUsers } from '../api';

// The sidebar's chat list, most recent first, with unread counts for chats that aren't open
const useRecentChats = () => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unread, setUnread] = useState({}); // {userId -> number of new messages}
    const { selectedConversation, setBlockedIds } = useConversation();
    const selectedUserId = selectedConversation?._id;

    // also re-run on every new message to bring that chat to the top
    const reload = useCallback(async () => {
        try {
            setChats(await getRecentChats());
        } catch (error) {
            logger.error('Could not load chats', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
        // who I blocked: the chat window and contact info need it
        getBlockedUsers()
            .then((users) => setBlockedIds(users.map((u) => u._id)))
            .catch((error) => logger.error('Could not load blocked users', error));
    }, [reload, setBlockedIds]);

    useSocketEvent('newMessage', (message) => {
        // the open chat shows it right away; others get a badge
        if (message.senderId !== selectedUserId) {
            setUnread((prev) => ({ ...prev, [message.senderId]: (prev[message.senderId] || 0) + 1 }));
        }
        reload();
    });

    const markRead = useCallback((userId) => setUnread((prev) => ({ ...prev, [userId]: 0 })), []);

    return { chats, loading, unread, markRead };
};

export default useRecentChats;
