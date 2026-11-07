import { FiArrowLeft } from 'react-icons/fi';
import Avatar from '../../../shared/ui/Avatar';
import OnlineStatus from '../../../shared/ui/OnlineStatus';

// Top bar of the open chat: back (mobile), contact, and typing / blocked / online status
const ChatHeader = ({ contact, online, lastSeen, isTyping, blocked, onBack, onOpenContact }) => {
    const name = contact.fullname || contact.username;
    return (
        <header className='flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5'>
            <button onClick={onBack} aria-label='Back to chats'
                className='grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 md:hidden'>
                <FiArrowLeft className='h-5 w-5' />
            </button>
            <button onClick={onOpenContact} aria-label={`Contact info for ${name}`}
                className='-ml-1 flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-slate-50'>
                <Avatar user={contact} online={online} />
                <span className='min-w-0'>
                    <span className='block truncate font-semibold text-slate-900'>{name}</span>
                    <span className='block text-xs' aria-live='polite'>
                        {isTyping ? (
                            <span className='font-medium text-brand-600'>typing…</span>
                        ) : blocked ? (
                            <span className='text-slate-500'>Blocked</span>
                        ) : (
                            <OnlineStatus online={online} lastSeen={lastSeen} />
                        )}
                    </span>
                </span>
            </button>
        </header>
    );
};

export default ChatHeader;
