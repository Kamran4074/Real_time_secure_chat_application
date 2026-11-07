import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import useConversation from '../../../shared/store/useConversation';
import useSocketEvent from '../../../shared/realtime/useSocketEvent';
import { errorMessage } from '../../../shared/api/client';
import logger from '../../../shared/lib/logger';
import notifySound from '../../../assets/sound/notification.mp3';
import { getMessages, sendMessage, PAGE_SIZE } from '../api';

const isSelected = (id) => useConversation.getState().selectedConversation?._id === id;

// Messages of the open chat: first page, older pages (scrolling up), live incoming ones, sending.
// markSeen: from useReadReceipts. onIncoming: runs when a message from them arrives live.
const useMessages = (otherId, { markSeen, onIncoming }) => {
    const { messages, setMessage, addMessage, prependMessages } = useConversation();
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [sending, setSending] = useState(false);
    const loadingOlderRef = useRef(false);

    // newest page whenever another chat is opened
    useEffect(() => {
        if (!otherId) return;
        const load = async () => {
            setLoading(true);
            setHasMore(false);
            try {
                const page = await getMessages(otherId);
                if (!isSelected(otherId)) return; // switched chats while this was loading
                setMessage(page);
                setHasMore(page.length === PAGE_SIZE);
                markSeen(otherId);
            } catch (error) {
                logger.error('Could not load messages', error);
            } finally {
                if (isSelected(otherId)) setLoading(false);
            }
        };
        load();
    }, [otherId, setMessage, markSeen]);

    // a message from the person whose chat is open
    useSocketEvent('newMessage', (message) => {
        if (message.senderId !== otherId) return;
        new Audio(notifySound).play().catch(() => {});
        addMessage(message);
        onIncoming?.();
        markSeen(message.senderId);
    });

    // the page before the oldest message shown. beforePrepend runs right before they are added
    // (MessageList uses it to keep the scroll position).
    const loadOlder = async (beforePrepend) => {
        const oldest = useConversation.getState().messages[0];
        if (!otherId || !oldest || !hasMore || loadingOlderRef.current) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const page = await getMessages(otherId, oldest._id);
            if (!isSelected(otherId)) return;
            beforePrepend?.();
            prependMessages(page);
            setHasMore(page.length === PAGE_SIZE);
        } catch (error) {
            toast.error(errorMessage(error, 'Could not load older messages'));
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    };

    // true when sent
    const send = async (text) => {
        setSending(true);
        try {
            addMessage(await sendMessage(otherId, text));
            return true;
        } catch (error) {
            toast.error(errorMessage(error, 'Message not sent'));
            return false;
        } finally {
            setSending(false);
        }
    };

    return { messages, loading, hasMore, loadingOlder, loadOlder, send, sending };
};

export default useMessages;
