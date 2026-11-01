import { Fragment, useCallback, useEffect, useLayoutEffect, useState, useRef } from 'react'
import useConversation from '../../store/useConversation';
import { useAuth } from '../../context/AuthContext';
import { HiChatBubbleLeftRight } from 'react-icons/hi2';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import { BsCheck, BsCheckAll } from 'react-icons/bs';
import axios from 'axios';
import { useSocketContext } from '../../context/SocketContext';
import notify from '../../assets/sound/notification.mp3';
import { toast } from 'react-toastify';
import Avatar from '../../components/ui/Avatar';
import TypingDots from '../../components/ui/TypingDots';
import { Spinner } from '../../components/ui/Button';
import logger from '../../utils/logger';
import ContactPanel from './ContactPanel';
import OnlineStatus from '../../components/ui/OnlineStatus';
import useBlockToggle from '../useBlockToggle';

const MAX_LENGTH = 2000;
const PAGE_SIZE = 30;          // the backend's default page; a shorter page means nothing older
const LOAD_OLDER_WITHIN_PX = 120; // start loading older messages this close to the top

// ✓ sent, ✓✓ delivered, blue ✓✓ seen
const Ticks = ({ message }) => {
    if (message.seenAt) return <BsCheckAll aria-label='Seen' className='h-4 w-4 text-sky-300' />;
    if (message.deliveredAt) return <BsCheckAll aria-label='Delivered' className='h-4 w-4 text-brand-100' />;
    return <BsCheck aria-label='Sent' className='h-4 w-4 text-brand-100' />;
};

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

const timeLabel = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const MessagesSkeleton = () => (
    <div className='space-y-4' aria-hidden>
        {['w-1/2', 'w-1/3 ml-auto', 'w-2/5', 'w-1/2 ml-auto', 'w-1/4'].map((cls, i) => (
            <div key={i} className={`h-10 animate-pulse rounded-2xl bg-slate-200/70 ${cls}`} />
        ))}
    </div>
);

const MessageContainer = ({ onBackUser }) => {
    const { messages, selectedConversation, setMessage, addMessage, prependMessages, updateMessages, blockedIds } = useConversation();
    const [showContact, setShowContact] = useState(false);
    const { toggle: toggleBlock, busy: unblocking } = useBlockToggle();
    const closeContact = useCallback(() => setShowContact(false), []);
    const {socket, onlineUser, lastSeen: liveLastSeen = {}} = useSocketContext();
    const { authUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sending , setSending] = useState(false);
    const [sendData , setSendData] = useState("")
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef();
    const inputRef = useRef();
    const typingTimeoutRef = useRef(null);
    const typingSentRef = useRef(false); // "typing" already told for this burst of keystrokes
    const listRef = useRef();
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const loadingOlderRef = useRef(false);
    const restoreScrollRef = useRef(null); // keeps the view still when older messages are added above

    const isOnline = onlineUser.includes(selectedConversation?._id);
    const blocked = blockedIds.includes(selectedConversation?._id);
    const name = selectedConversation?.fullname || selectedConversation?.username;
    const lastSeen = liveLastSeen[selectedConversation?._id] || selectedConversation?.lastSeen;
    const isSelected = (id) => useConversation.getState().selectedConversation?._id === id;

    // I'm looking at this chat: their unseen messages become seen (sender's ticks turn blue)
    const markSeen = useCallback((otherId) => {
        if (document.visibilityState !== 'visible') return;
        const unseen = useConversation.getState().messages.some(m => m.senderId === otherId && !m.seenAt);
        if (!unseen) return;
        const at = new Date().toISOString();
        updateMessages(m => (m.senderId === otherId && !m.seenAt ? { ...m, seenAt: at } : m));
        axios.post(`/api/message/seen/${otherId}`).catch(error => logger.error('Could not mark messages seen', error));
    }, [updateMessages]);

    useEffect(()=>{
      const handleNewMessage = (newMessage)=>{
        // Only add message if it's for the current conversation
        if(selectedConversation?._id === newMessage.senderId){
          const sound = new Audio(notify);
          sound.play().catch(()=>{});
          addMessage(newMessage)
          setIsTyping(false)
          markSeen(newMessage.senderId)
        }
      }

      socket?.on("newMessage", handleNewMessage)

      return ()=> socket?.off("newMessage", handleNewMessage);
    },[socket,addMessage,selectedConversation,markSeen])

    // read receipts for my messages in the open chat
    useEffect(()=>{
      const mine = (m)=> m.senderId === authUser?._id;
      const handleDelivered = ({receiverId, at})=>{
        if(receiverId !== selectedConversation?._id) return;
        updateMessages(m => (mine(m) && !m.deliveredAt ? { ...m, deliveredAt: at } : m));
      };
      const handleSeen = ({receiverId, at})=>{
        if(receiverId !== selectedConversation?._id) return;
        updateMessages(m => (mine(m) && !m.seenAt ? { ...m, seenAt: at, deliveredAt: m.deliveredAt || at } : m));
      };
      socket?.on('messagesDelivered', handleDelivered);
      socket?.on('messagesSeen', handleSeen);
      return ()=>{
        socket?.off('messagesDelivered', handleDelivered);
        socket?.off('messagesSeen', handleSeen);
      };
    },[socket, selectedConversation?._id, authUser?._id, updateMessages])

    // came back to this tab with the chat open: mark what arrived meanwhile as seen
    useEffect(()=>{
      const id = selectedConversation?._id;
      if(!id) return;
      const onVisible = ()=> document.visibilityState === 'visible' && markSeen(id);
      document.addEventListener('visibilitychange', onVisible);
      return ()=> document.removeEventListener('visibilitychange', onVisible);
    },[selectedConversation?._id, markSeen])

    // Listen for typing events
    useEffect(()=>{
      const handleUserTyping = ({senderId}) => {
        if(senderId === selectedConversation?._id){
          setIsTyping(true);
        }
      };

      const handleUserStoppedTyping = ({senderId}) => {
        if(senderId === selectedConversation?._id){
          setIsTyping(false);
        }
      };

      socket?.on("userTyping", handleUserTyping);
      socket?.on("userStoppedTyping", handleUserStoppedTyping);

      return ()=> {
        socket?.off("userTyping", handleUserTyping);
        socket?.off("userStoppedTyping", handleUserStoppedTyping);
      };
    },[socket, selectedConversation])

    // follow new messages at the bottom (not when older ones are added at the top)
    const lastMessageId = messages[messages.length - 1]?._id;
    useEffect(()=>{
        bottomRef.current?.scrollIntoView({behavior:"smooth", block:"end"})
    },[lastMessageId, isTyping])

    // after older messages were added above, keep what the user was reading in the same place
    useLayoutEffect(()=>{
        const restore = restoreScrollRef.current;
        const list = listRef.current;
        if(!restore || !list) return;
        list.scrollTop = list.scrollHeight - restore.height + restore.top;
        restoreScrollRef.current = null;
    },[messages])

    useEffect(() => {
        const id = selectedConversation?._id;
        const getMessages = async () => {
            setLoading(true);
            setHasMore(false);
            try {
                const get = await axios.get(`/api/message/${id}`);
                if (!isSelected(id)) return; // switched chats while this was loading
                setMessage(get.data);
                setHasMore(get.data.length === PAGE_SIZE);
                markSeen(id);
            } catch (error) {
                logger.error('Could not load messages', error);
            } finally {
                if (isSelected(id)) setLoading(false);
            }
        }

        setIsTyping(false);
        setSendData('');
        setShowContact(false);
        if (selectedConversation?._id) {
            getMessages();
            inputRef.current?.focus();
        }
    }, [selectedConversation?._id, setMessage, markSeen])

    // scrolling up: load the page before the oldest message shown
    const loadOlder = async () => {
        const id = selectedConversation?._id;
        const oldest = useConversation.getState().messages[0];
        if (!id || !oldest || !hasMore || loadingOlderRef.current) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const { data } = await axios.get(`/api/message/${id}`, { params: { before: oldest._id } });
            if (!isSelected(id)) return;
            const list = listRef.current;
            restoreScrollRef.current = list && { height: list.scrollHeight, top: list.scrollTop };
            prependMessages(data);
            setHasMore(data.length === PAGE_SIZE);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Could not load older messages');
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    };

    const handleScroll = (e) => {
        if (e.currentTarget.scrollTop < LOAD_OLDER_WITHIN_PX) loadOlder();
    };

    // switching chats (or leaving) mid-typing: tell the previous person right away
    useEffect(()=>{
        const receiverId = selectedConversation?._id;
        const typingTimeout = typingTimeoutRef;
        const typingSent = typingSentRef;
        return ()=>{
            clearTimeout(typingTimeout.current);
            if(typingSent.current && receiverId) socket?.emit('stopTyping', {receiverId});
            typingSent.current = false;
        };
    }, [selectedConversation?._id, socket])

    // end the current typing burst (if any) and tell the other side once
    const stopTyping = (receiverId)=>{
        clearTimeout(typingTimeoutRef.current);
        if(typingSentRef.current) socket?.emit('stopTyping', {receiverId});
        typingSentRef.current = false;
    }

    const handelMessages=(e)=>{
        setSendData(e.target.value)
        if(!e.target.value.length || !selectedConversation?._id) return;
        const receiverId = selectedConversation._id;

        // one "typing" per burst instead of one per keystroke
        if(!typingSentRef.current){
          socket?.emit('typing', {receiverId});
          typingSentRef.current = true;
        }
        // debounced: "stopTyping" once there's been no key for 2 seconds
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(()=> stopTyping(receiverId), 2000);
      }

    const handelSubmit=async(e)=>{
        e.preventDefault();
        if(!sendData.trim() || sending) return;

        // Stop typing indicator when sending
        stopTyping(selectedConversation._id);

        setSending(true);
        try {
            const res =await axios.post(`/api/message/send/${selectedConversation?._id}`,{messages:sendData});
            setSendData('')
            addMessage(res.data)
        } catch (error) {
            toast.error(error?.response?.data?.message || "Message not sent")
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    }

    if (!selectedConversation) {
        return (
            <div className='chat-pattern flex h-full flex-col items-center justify-center bg-slate-50 px-6 text-center'>
                <span className='grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-xl shadow-brand-500/30'>
                    <HiChatBubbleLeftRight className='h-10 w-10' />
                </span>
                <h2 className='mt-6 text-2xl font-bold tracking-tight text-slate-900'>
                    Welcome, {(authUser?.fullname || authUser?.username || '').split(' ')[0]} 👋
                </h2>
                <p className='mt-2 max-w-sm text-slate-500'>
                    Pick a conversation from the list, or search for someone by name or username to start a new chat.
                </p>
            </div>
        );
    }

    return (
        <div className='relative flex h-full flex-col overflow-hidden'>
            {showContact && <ContactPanel user={selectedConversation} online={isOnline} lastSeen={lastSeen} onClose={closeContact} />}
            {/* header */}
            <header className='flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5'>
                <button onClick={onBackUser} aria-label='Back to chats'
                    className='grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 md:hidden'>
                    <FiArrowLeft className='h-5 w-5' />
                </button>
                <button onClick={() => setShowContact(true)} aria-label={`Contact info for ${name}`}
                    className='-ml-1 flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-slate-50'>
                <Avatar user={selectedConversation} online={isOnline} />
                <span className='min-w-0'>
                    <span className='block truncate font-semibold text-slate-900'>{name}</span>
                    <span className='block text-xs' aria-live='polite'>
                        {isTyping ? (
                            <span className='font-medium text-brand-600'>typing…</span>
                        ) : blocked ? (
                            <span className='text-slate-500'>Blocked</span>
                        ) : (
                            <OnlineStatus online={isOnline} lastSeen={lastSeen} />
                        )}
                    </span>
                </span>
                </button>
            </header>

            {/* messages */}
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
                {loading ? <MessagesSkeleton /> : messages?.length === 0 ? (
                    <div className='flex h-full flex-col items-center justify-center text-center'>
                        <Avatar user={selectedConversation} size='lg' />
                        <p className='mt-4 font-semibold text-slate-900'>This is the start of your chat with {name}</p>
                        <p className='mt-1 text-sm text-slate-500'>Say hi 👋</p>
                    </div>
                ) : (
                    messages.map((message, i) => {
                        const prev = messages[i - 1];
                        const mine = message.senderId === authUser._id;
                        const newDay = !prev ||
                            new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                        const grouped = !newDay && prev?.senderId === message.senderId;
                        return (
                            <Fragment key={message._id}>
                                {newDay && (
                                    <div className='my-4 flex justify-center'>
                                        <span className='rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200'>
                                            {dayLabel(message.createdAt)}
                                        </span>
                                    </div>
                                )}
                                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-3'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[70%] lg:max-w-[60%]
                                        ${mine
                                            ? 'rounded-br-md bg-brand-600 text-white'
                                            : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200'}`}>
                                        <p className='whitespace-pre-wrap break-words text-[15px] leading-relaxed'>{message.message}</p>
                                        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                                            {timeLabel(message.createdAt)}
                                            {mine && <Ticks message={message} />}
                                        </p>
                                    </div>
                                </div>
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

            {/* composer (replaced by a notice while this user is blocked) */}
            {blocked ? (
                <div className='flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 bg-white p-4 text-center sm:flex-row sm:justify-center'>
                    <p className='text-sm text-slate-600'>You blocked {name}. You can&apos;t send or receive messages.</p>
                    <button onClick={() => toggleBlock(selectedConversation, false)} disabled={unblocking}
                        className='rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-60'>
                        {unblocking ? 'Unblocking…' : 'Unblock'}
                    </button>
                </div>
            ) : (
            <form onSubmit={handelSubmit} className='flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white p-3 sm:px-5'>
                <div className='relative flex-1'>
                    <input
                        ref={inputRef}
                        value={sendData}
                        onChange={handelMessages}
                        maxLength={MAX_LENGTH}
                        autoComplete='off'
                        placeholder={`Message ${name}`}
                        aria-label='Type a message'
                        className={`h-12 w-full rounded-full border border-transparent bg-slate-100 pl-5 text-[15px] text-slate-900
                        placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15
                        ${sendData.length > MAX_LENGTH - 200 ? 'pr-24' : 'pr-5'}`}
                    />
                    {sendData.length > MAX_LENGTH - 200 && (
                        <span className='absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400'>
                            {sendData.length}/{MAX_LENGTH}
                        </span>
                    )}
                </div>
                <button type='submit' disabled={!sendData.trim() || sending} aria-label='Send message'
                    className='grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/30 transition
                    hover:bg-brand-700 active:scale-95 disabled:bg-slate-300 disabled:shadow-none'>
                    {sending ? <Spinner /> : <FiSend className='-ml-0.5 h-5 w-5' />}
                </button>
            </form>
            )}
        </div>
    )
}

export default MessageContainer
