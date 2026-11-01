import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios';
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiX, FiLogOut, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import useConversation from '../../store/useConversation';
import { useSocketContext } from '../../context/SocketContext';
import Logo from '../../components/ui/Logo';
import Avatar from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Button';
import logger from '../../utils/logger';
import ProfilePanel from './ProfilePanel';
import OnlineStatus from '../../components/ui/OnlineStatus';

const MIN_SEARCH = 2;      // same as the backend
const SEARCH_DELAY_MS = 300; // search once typing pauses
// "@kamran" and "kamran" search the same
const toQuery = (input) => input.trim().replace(/^@/, '');

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

const Sidebar = () => {

    const navigate = useNavigate();
    const { authUser, setAuthUser } = useAuth();
    const [searchInput, setSearchInput] = useState('');
    const [searchUser, setSearchuser] = useState(null); // null = not searching
    const [chatUser, setChatUser] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState({});
    const [showProfile, setShowProfile] = useState(false);
    const { selectedConversation, setSelectedConversation, reset, setBlockedIds } = useConversation();
    const latestSearch = useRef('');
    const { onlineUser , socket} = useSocketContext();
    const selectedUserId = selectedConversation?._id;

    //show user with u chatted (also re-run to bring the latest chat to the top)
    const chatUserHandler = async () => {
        try {
            const chatters = await axios.get(`/api/user/currentchatters`)
            setChatUser(chatters.data)
        } catch (error) {
            logger.error('Could not load chats', error);
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        chatUserHandler()
        // who I blocked: the chat window and contact info need it
        axios.get('/api/user/blocked')
            .then(({ data }) => setBlockedIds(data.map(u => u._id)))
            .catch((error) => logger.error('Could not load blocked users', error));
    }, [setBlockedIds])

    useEffect(()=>{
        const handleNewMessage = (newMessage)=>{
            // Only count if message is not from selected conversation
            if(newMessage.senderId !== selectedUserId) {
                setUnreadMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1
                }));
            }
            chatUserHandler()
        }
        socket?.on("newMessage", handleNewMessage)
        // remove only our own listener, not MessageContainer's
        return ()=> socket?.off("newMessage", handleNewMessage);
    },[socket,selectedUserId])

    //show user from the search result (only the latest query's answer is used)
    const runSearch = useCallback(async (query) => {
        latestSearch.current = query;
        setSearching(true)
        try {
            const search = await axios.get(`/api/user/search`, { params: { search: query } });
            if (latestSearch.current === query) setSearchuser(search.data)
        } catch (error) {
            if (latestSearch.current === query) toast.error(error?.response?.data?.message || 'Search failed')
        } finally {
            if (latestSearch.current === query) setSearching(false)
        }
    }, [])

    // search as you type, once typing pauses; clearing the box goes back to the chats
    useEffect(() => {
        const query = toQuery(searchInput);
        if (query.length < MIN_SEARCH) {
            latestSearch.current = '';
            setSearching(false);
            if (!query) setSearchuser(null);
            return;
        }
        const timer = setTimeout(() => runSearch(query), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [searchInput, runSearch])

    // Enter searches right away
    const handelSearchSubmit = (e) => {
        e.preventDefault();
        const query = toQuery(searchInput);
        if (query.length >= MIN_SEARCH) runSearch(query);
    }

    //show which user is selected
    const handelUserClick = (user) => {
        setSelectedConversation(user);
        // Clear unread count for this user
        setUnreadMessages(prev => ({
            ...prev,
            [user._id]: 0
        }));
    }

    //back from search result
    const clearSearch = () => {
        setSearchuser(null);
        setSearchInput('')
    }

    // forget the session on this device and go to login
    const clearSession = useCallback(() => {
        localStorage.removeItem('chatapp')
        reset()
        setAuthUser(null)
        navigate('/login')
    }, [reset, setAuthUser, navigate])

    //logout
    const handelLogOut = async () => {
        const confirmLogout = window.confirm("Do you want to log out?");
        if (confirmLogout) {
            try {
                const logout = await axios.post('/api/auth/logout')
                toast.info(logout.data?.message)
            } catch (error) {
                logger.error('Logout request failed', error);
            } finally {
                // always clear the local session, even if the request failed
                clearSession()
            }
        }
    }

    const list = searchUser ?? chatUser;
    const closeProfile = useCallback(() => setShowProfile(false), []);

    return (
        <div className='relative flex h-full w-full flex-col overflow-hidden bg-white'>
            {showProfile && <ProfilePanel onClose={closeProfile} onSignedOut={clearSession} />}
            <header className='px-5 pb-4 pt-5'>
                <Logo />
                <form onSubmit={handelSearchSubmit} role='search' className='relative mt-5'>
                    <FiSearch aria-hidden className='pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400' />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        type='text'
                        enterKeyHint='search'
                        maxLength={50}
                        placeholder='Search by name or @username'
                        aria-label='Search people by name or username'
                        className='h-11 w-full rounded-xl border border-transparent bg-slate-100 pl-11 pr-10 text-[15px] text-slate-900
                        placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15'
                    />
                    <span className='absolute right-2 top-1/2 -translate-y-1/2'>
                        {searching ? (
                            <span className='grid h-7 w-7 place-items-center'><Spinner className='border-slate-300 border-t-brand-600' /></span>
                        ) : (searchInput || searchUser) && (
                            <button type='button' onClick={clearSearch} aria-label='Clear search'
                                className='grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600'>
                                <FiX />
                            </button>
                        )}
                    </span>
                </form>
            </header>

            <div className='flex items-center justify-between px-5 pb-2'>
                <h2 className='text-xs font-semibold uppercase tracking-wider text-slate-500'>
                    {searchUser ? `Search results · ${searchUser.length}` : 'Recent chats'}
                </h2>
                {searchUser && (
                    <button onClick={clearSearch} className='text-xs font-semibold text-brand-600 hover:text-brand-700'>
                        Back to chats
                    </button>
                )}
            </div>

            <nav className='scroll-thin flex-1 overflow-y-auto px-3 pb-3' aria-label='Conversations'>
                {loading ? <SkeletonList /> : list.length === 0 ? <EmptyState searching={!!searchUser} /> : (
                    <ul className='space-y-0.5'>
                        {list.map((user) => {
                            const unread = unreadMessages[user._id] || 0;
                            const active = selectedUserId === user._id;
                            const online = onlineUser.includes(user._id);
                            return (
                                <li key={user._id}>
                                    <button
                                        onClick={() => handelUserClick(user)}
                                        aria-current={active ? 'true' : undefined}
                                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition
                                            ${active ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-slate-50'}`}
                                    >
                                        <Avatar user={user} online={online} />
                                        <span className='min-w-0 flex-1'>
                                            <span className={`block truncate text-[15px] ${unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                                {user.fullname || user.username}
                                            </span>
                                            <span className='flex min-w-0 items-center gap-1.5 text-sm'>
                                                <OnlineStatus online={online} className='shrink-0' />
                                                <span className='truncate text-slate-400'>· @{user.username}</span>
                                            </span>
                                        </span>
                                        {unread > 0 && (
                                            <span className='grid h-[22px] min-w-[22px] place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white'
                                                aria-label={`${unread} unread messages`}>
                                                {unread > 9 ? '9+' : unread}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </nav>

            <footer className='flex items-center gap-3 border-t border-slate-200 px-5 py-3'>
                <button onClick={() => setShowProfile(true)} title='Open profile' aria-label='Open profile'
                    className='-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-slate-50'>
                    <Avatar user={authUser} size='sm' online />
                    <span className='min-w-0 flex-1'>
                        <span className='block truncate text-sm font-semibold text-slate-900'>{authUser?.fullname || authUser?.username}</span>
                        <span className='block truncate text-xs text-slate-500'>@{authUser?.username}</span>
                    </span>
                </button>
                <button onClick={handelLogOut} title='Log out' aria-label='Log out'
                    className='grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600'>
                    <FiLogOut className='h-[18px] w-[18px]' />
                </button>
            </footer>
        </div>
    )
}

export default Sidebar
