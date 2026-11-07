import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth';
import { ContactPanel, useBlockToggle } from '../../contacts';
import useConversation from '../../../shared/store/useConversation';
import { useSocketContext } from '../../../shared/realtime/SocketContext';
import useReadReceipts from '../hooks/useReadReceipts';
import useTyping from '../hooks/useTyping';
import useMessages from '../hooks/useMessages';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import WelcomeScreen from './WelcomeScreen';

// Shown instead of the composer while I have blocked this contact
const BlockedNotice = ({ name, onUnblock, busy }) => (
    <div className='flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 bg-white p-4 text-center sm:flex-row sm:justify-center'>
        <p className='text-sm text-slate-600'>You blocked {name}. You can&apos;t send or receive messages.</p>
        <button onClick={onUnblock} disabled={busy}
            className='rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-60'>
            {busy ? 'Unblocking…' : 'Unblock'}
        </button>
    </div>
);

// The right column: the open conversation (or a welcome screen when none is open)
const ChatWindow = ({ onBackUser }) => {
    const { authUser } = useAuth();
    const { selectedConversation: contact, blockedIds } = useConversation();
    const { onlineUser, lastSeen: liveLastSeen = {} } = useSocketContext();
    const { toggle: toggleBlock, busy: unblocking } = useBlockToggle();
    const [showContact, setShowContact] = useState(false);
    const otherId = contact?._id;

    const markSeen = useReadReceipts(otherId);
    const typing = useTyping(otherId);
    const chat = useMessages(otherId, { markSeen, onIncoming: typing.clearTyping });

    // another chat opened: close the contact drawer
    useEffect(() => setShowContact(false), [otherId]);
    const closeContact = useCallback(() => setShowContact(false), []);

    if (!contact) return <WelcomeScreen user={authUser} />;

    const name = contact.fullname || contact.username;
    const online = onlineUser.includes(otherId);
    const blocked = blockedIds.includes(otherId);
    const lastSeen = liveLastSeen[otherId] || contact.lastSeen;

    return (
        <div className='relative flex h-full flex-col overflow-hidden'>
            {showContact && <ContactPanel user={contact} online={online} lastSeen={lastSeen} onClose={closeContact} />}
            <ChatHeader contact={contact} online={online} lastSeen={lastSeen} isTyping={typing.isTyping} blocked={blocked}
                onBack={onBackUser} onOpenContact={() => setShowContact(true)} />
            <MessageList messages={chat.messages} myId={authUser?._id} contact={contact} loading={chat.loading}
                hasMore={chat.hasMore} loadingOlder={chat.loadingOlder} onLoadOlder={chat.loadOlder} isTyping={typing.isTyping} />
            {blocked ? (
                <BlockedNotice name={name} busy={unblocking} onUnblock={() => toggleBlock(contact, false)} />
            ) : (
                <MessageComposer key={otherId} name={name} sending={chat.sending} onSend={chat.send}
                    onTyping={typing.onInput} onStopTyping={typing.stopTyping} />
            )}
        </div>
    );
};

export default ChatWindow;
