import { toast } from 'react-toastify';
import { FiLogOut } from 'react-icons/fi';
import { useAuth, useSignOut, logout } from '../../auth';
import useConversation from '../../../shared/store/useConversation';
import { useSocketContext } from '../../../shared/realtime/SocketContext';
import { useConfirm } from '../../../shared/ui/confirm/confirmContext';
import Logo from '../../../shared/ui/Logo';
import Avatar from '../../../shared/ui/Avatar';
import logger from '../../../shared/lib/logger';
import useRecentChats from '../hooks/useRecentChats';
import useUserSearch from '../hooks/useUserSearch';
import SearchBox from './SearchBox';
import ChatList from './ChatList';

// Left column: search, recent chats / search results, and the signed-in user
const Sidebar = ({ onOpenProfile }) => {
    const { authUser } = useAuth();
    const signOut = useSignOut();
    const confirm = useConfirm();
    const { onlineUser } = useSocketContext();
    const { selectedConversation, setSelectedConversation } = useConversation();
    const { chats, loading, unread, markRead } = useRecentChats();
    const search = useUserSearch();
    const selectedUserId = selectedConversation?._id;

    const openChat = (user) => {
        setSelectedConversation(user);
        markRead(user._id);
    };

    const handleLogout = async () => {
        const ok = await confirm({
            title: 'Log out?',
            message: "You'll need to sign in again to use ChatWave on this device.",
            confirmLabel: 'Log out',
            tone: 'danger',
            icon: FiLogOut,
        });
        if (!ok) return;
        try {
            const data = await logout();
            toast.info(data?.message);
        } catch (error) {
            logger.error('Logout request failed', error);
        } finally {
            // always clear the local session, even if the request failed
            signOut();
        }
    };

    const results = search.results;

    return (
        <div className='relative flex h-full w-full flex-col overflow-hidden bg-white'>
            <header className='px-5 pb-4 pt-5'>
                <Logo />
                <SearchBox
                    value={search.input}
                    onChange={search.setInput}
                    onSubmit={search.searchNow}
                    onClear={search.clear}
                    searching={search.searching}
                    showClear={Boolean(search.input || results)}
                />
            </header>

            <div className='flex items-center justify-between px-5 pb-2'>
                <h2 className='text-xs font-semibold uppercase tracking-wider text-slate-500'>
                    {results ? `Search results · ${results.length}` : 'Recent chats'}
                </h2>
                {results && (
                    <button onClick={search.clear} className='text-xs font-semibold text-brand-600 hover:text-brand-700'>
                        Back to chats
                    </button>
                )}
            </div>

            <nav className='scroll-thin flex-1 overflow-y-auto px-3 pb-3' aria-label='Conversations'>
                <ChatList
                    users={results ?? chats}
                    loading={loading}
                    searching={Boolean(results)}
                    selectedUserId={selectedUserId}
                    onlineUser={onlineUser}
                    unread={unread}
                    onSelect={openChat}
                />
            </nav>

            <footer className='flex items-center gap-3 border-t border-slate-200 px-5 py-3'>
                <button onClick={onOpenProfile} title='Open profile' aria-label='Open profile'
                    className='-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-slate-50'>
                    <Avatar user={authUser} size='sm' online />
                    <span className='min-w-0 flex-1'>
                        <span className='block truncate text-sm font-semibold text-slate-900'>{authUser?.fullname || authUser?.username}</span>
                        <span className='block truncate text-xs text-slate-500'>@{authUser?.username}</span>
                    </span>
                </button>
                <button onClick={handleLogout} title='Log out' aria-label='Log out'
                    className='grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600'>
                    <FiLogOut className='h-[18px] w-[18px]' />
                </button>
            </footer>
        </div>
    );
};

export default Sidebar;
