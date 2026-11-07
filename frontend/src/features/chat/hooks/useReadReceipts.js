import { useCallback, useEffect } from 'react';
import { useAuth } from '../../auth';
import useConversation from '../../../shared/store/useConversation';
import useSocketEvent from '../../../shared/realtime/useSocketEvent';
import logger from '../../../shared/lib/logger';
import { markSeen as markSeenRequest } from '../api';

// ✓ sent, ✓✓ delivered, blue ✓✓ seen.
// Returns markSeen(otherId): "I'm looking at this chat", so their unseen messages become seen.
const useReadReceipts = (otherId) => {
    const { authUser } = useAuth();
    const updateMessages = useConversation((s) => s.updateMessages);

    const markSeen = useCallback((id) => {
        if (document.visibilityState !== 'visible') return;
        const unseen = useConversation.getState().messages.some((m) => m.senderId === id && !m.seenAt);
        if (!unseen) return;
        const at = new Date().toISOString();
        updateMessages((m) => (m.senderId === id && !m.seenAt ? { ...m, seenAt: at } : m));
        markSeenRequest(id).catch((error) => logger.error('Could not mark messages seen', error));
    }, [updateMessages]);

    // the other person's device got / read my messages: update my ticks live
    const mine = (m) => m.senderId === authUser?._id;
    useSocketEvent('messagesDelivered', ({ receiverId, at }) => {
        if (receiverId !== otherId) return;
        updateMessages((m) => (mine(m) && !m.deliveredAt ? { ...m, deliveredAt: at } : m));
    });
    useSocketEvent('messagesSeen', ({ receiverId, at }) => {
        if (receiverId !== otherId) return;
        updateMessages((m) => (mine(m) && !m.seenAt ? { ...m, seenAt: at, deliveredAt: m.deliveredAt || at } : m));
    });

    // came back to this tab with the chat open: mark what arrived meanwhile as seen
    useEffect(() => {
        if (!otherId) return;
        const onVisible = () => document.visibilityState === 'visible' && markSeen(otherId);
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [otherId, markSeen]);

    return markSeen;
};

export default useReadReceipts;
