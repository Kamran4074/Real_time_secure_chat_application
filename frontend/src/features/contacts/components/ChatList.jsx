import { FiSearch, FiUsers } from 'react-icons/fi';
import Avatar from '../../../shared/ui/Avatar';
import OnlineStatus from '../../../shared/ui/OnlineStatus';

const SkeletonList = () => (
    <ul className='space-y-1 px-1' aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className='flex animate-pulse items-center gap-3 px-2 py-2.5'>
                <span className='h-11 w-11 rounded-full bg-slate-200' />
                <span className='flex-1 space-y-2'>
                    <span className='block h-3 w-2/3 rounded bg-slate-200' />
                    <span className='block h-2.5 w-1/3 rounded bg-slate-100' />
                </span>
            </li>
        ))}
    </ul>
);

const EmptyState = ({ searching }) => (
    <div className='flex flex-col items-center px-6 py-14 text-center'>
        <span className='grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600'>
            {searching ? <FiSearch className='h-6 w-6' /> : <FiUsers className='h-6 w-6' />}
        </span>
        <p className='mt-4 font-semibold text-slate-900'>{searching ? 'No people found' : 'No conversations yet'}</p>
        <p className='mt-1 text-sm text-slate-500'>
            {searching
                ? 'Try the start of a name or username.'
                : 'Search for someone by name or username to start chatting.'}
        </p>
    </div>
);

// Recent chats or search results; one row per person with online status and unread badge
const ChatList = ({ users, loading, searching, selectedUserId, onlineUser, unread, onSelect }) => {
    if (loading) return <SkeletonList />;
    if (users.length === 0) return <EmptyState searching={searching} />;

    return (
        <ul className='space-y-0.5'>
            {users.map((user) => {
                const count = unread[user._id] || 0;
                const active = selectedUserId === user._id;
                const online = onlineUser.includes(user._id);
                return (
                    <li key={user._id}>
                        <button
                            onClick={() => onSelect(user)}
                            aria-current={active ? 'true' : undefined}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition
                                ${active ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-slate-50'}`}
                        >
                            <Avatar user={user} online={online} />
                            <span className='min-w-0 flex-1'>
                                <span className={`block truncate text-[15px] ${count ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                    {user.fullname || user.username}
                                </span>
                                <span className='flex min-w-0 items-center gap-1.5 text-sm'>
                                    <OnlineStatus online={online} className='shrink-0' />
                                    <span className='truncate text-slate-400'>· @{user.username}</span>
                                </span>
                            </span>
                            {count > 0 && (
                                <span className='grid h-[22px] min-w-[22px] place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white'
                                    aria-label={`${count} unread messages`}>
                                    {count > 9 ? '9+' : count}
                                </span>
                            )}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

export default ChatList;
