import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import Avatar from '../../../shared/ui/Avatar';
import TypingDots from '../../../shared/ui/TypingDots';
import { Spinner } from '../../../shared/ui/Button';
import MessageBubble from './MessageBubble';

const LOAD_OLDER_WITHIN_PX = 120; // start loading older messages this close to the top

const dayLabel = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short',
        year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric'
    });
};

const MessagesSkeleton = () => (
    <div className='space-y-4' aria-hidden>
        {['w-1/2', 'w-1/3 ml-auto', 'w-2/5', 'w-1/2 ml-auto', 'w-1/4'].map((cls, i) => (
            <div key={i} className={`h-10 animate-pulse rounded-2xl bg-slate-200/70 ${cls}`} />
        ))}
    </div>
);

// The scrolling message area: day separators, bubbles, typing bubble, "load older" on scroll-up
const MessageList = ({ messages, myId, contact, loading, hasMore, loadingOlder, onLoadOlder, isTyping }) => {
    const listRef = useRef();
    const bottomRef = useRef();
    const restoreScrollRef = useRef(null); // keeps the view still when older messages are added above
    const name = contact.fullname || contact.username;

    // follow new messages at the bottom (not when older ones are added at the top)
    const lastMessageId = messages[messages.length - 1]?._id;
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [lastMessageId, isTyping]);

    // after older messages were added above, keep what the user was reading in the same place
    useLayoutEffect(() => {
        const restore = restoreScrollRef.current;
        const list = listRef.current;
        if (!restore || !list) return;
        list.scrollTop = list.scrollHeight - restore.height + restore.top;
        restoreScrollRef.current = null;
    }, [messages]);

    const loadOlder = () => onLoadOlder(() => {
        const list = listRef.current;
        restoreScrollRef.current = list && { height: list.scrollHeight, top: list.scrollTop };
    });

    const handleScroll = (e) => {
        if (e.currentTarget.scrollTop < LOAD_OLDER_WITHIN_PX) loadOlder();
    };

    return (
        <div ref={listRef} onScroll={handleScroll}
            className='chat-pattern scroll-thin flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6'>
            {!loading && hasMore && (
                <div className='mb-2 flex justify-center'>
                    <button onClick={loadOlder} disabled={loadingOlder}
                        className='inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-70'>
                        {loadingOlder && <Spinner className='border-slate-300 border-t-brand-600' />}
                        {loadingOlder ? 'Loading older messages…' : 'Load older messages'}
                    </button>
                </div>
            )}
            {loading ? <MessagesSkeleton /> : messages.length === 0 ? (
                <div className='flex h-full flex-col items-center justify-center text-center'>
                    <Avatar user={contact} size='lg' />
                    <p className='mt-4 font-semibold text-slate-900'>This is the start of your chat with {name}</p>
                    <p className='mt-1 text-sm text-slate-500'>Say hi 👋</p>
                </div>
            ) : (
                messages.map((message, i) => {
                    const prev = messages[i - 1];
                    const newDay = !prev ||
                        new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                    return (
                        <Fragment key={message._id}>
                            {newDay && (
                                <div className='my-4 flex justify-center'>
                                    <span className='rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200'>
                                        {dayLabel(message.createdAt)}
                                    </span>
                                </div>
                            )}
                            <MessageBubble message={message} mine={message.senderId === myId}
                                grouped={!newDay && prev?.senderId === message.senderId} />
                        </Fragment>
                    );
                })
            )}
            {isTyping && !loading && (
                <div className='mt-3 flex'>
                    <span className='rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200'>
                        <TypingDots />
                    </span>
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    );
};

export default MessageList;
