import { Fragment, useEffect, useState, useRef } from 'react'
import useConversation from '../../store/useConversation';
import { useAuth } from '../../context/AuthContext';
import { HiChatBubbleLeftRight } from 'react-icons/hi2';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import axios from 'axios';
import { useSocketContext } from '../../context/SocketContext';
import notify from '../../assets/sound/notification.mp3';
import { toast } from 'react-toastify';
import Avatar from '../../components/ui/Avatar';
import TypingDots from '../../components/ui/TypingDots';
import { Spinner } from '../../components/ui/Button';
import logger from '../../utils/logger';

const MAX_LENGTH = 2000;

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
    const { messages, selectedConversation, setMessage, addMessage } = useConversation();
    const {socket, onlineUser} = useSocketContext();
    const { authUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sending , setSending] = useState(false);
    const [sendData , setSendData] = useState("")
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef();
    const inputRef = useRef();
    const typingTimeoutRef = useRef(null);

    const isOnline = onlineUser.includes(selectedConversation?._id);
    const name = selectedConversation?.fullname || selectedConversation?.username;

    useEffect(()=>{
      const handleNewMessage = (newMessage)=>{
        // Only add message if it's for the current conversation
        if(selectedConversation?._id === newMessage.senderId){
          const sound = new Audio(notify);
          sound.play().catch(()=>{});
          addMessage(newMessage)
          setIsTyping(false)
        }
      }

      socket?.on("newMessage", handleNewMessage)

      return ()=> socket?.off("newMessage", handleNewMessage);
    },[socket,addMessage,selectedConversation])

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

    useEffect(()=>{
        bottomRef.current?.scrollIntoView({behavior:"smooth", block:"end"})
    },[messages, isTyping])

    useEffect(() => {
        const getMessages = async () => {
            setLoading(true);
            try {
                const get = await axios.get(`/api/message/${selectedConversation?._id}`);
                setMessage(get.data);
            } catch (error) {
                logger.error('Could not load messages', error);
            } finally {
                setLoading(false);
            }
        }

        setIsTyping(false);
        setSendData('');
        if (selectedConversation?._id) {
            getMessages();
            inputRef.current?.focus();
        }
    }, [selectedConversation?._id, setMessage])

    const handelMessages=(e)=>{
        setSendData(e.target.value)

        // Emit typing event
        if(e.target.value.length > 0 && selectedConversation?._id){
          socket?.emit('typing', {receiverId: selectedConversation._id});

          // Clear previous timeout
          if(typingTimeoutRef.current){
            clearTimeout(typingTimeoutRef.current);
          }

          // Stop typing after 2 seconds of inactivity
          typingTimeoutRef.current = setTimeout(()=>{
            socket?.emit('stopTyping', {receiverId: selectedConversation._id});
          }, 2000);
        }
      }

    const handelSubmit=async(e)=>{
        e.preventDefault();
        if(!sendData.trim() || sending) return;

        // Stop typing indicator when sending
        socket?.emit('stopTyping', {receiverId: selectedConversation._id});
        if(typingTimeoutRef.current){
          clearTimeout(typingTimeoutRef.current);
        }

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
        <div className='flex h-full flex-col'>
            {/* header */}
            <header className='flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5'>
                <button onClick={onBackUser} aria-label='Back to chats'
                    className='grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 md:hidden'>
                    <FiArrowLeft className='h-5 w-5' />
                </button>
                <Avatar user={selectedConversation} online={isOnline} />
                <div className='min-w-0'>
                    <p className='truncate font-semibold text-slate-900'>{name}</p>
                    <p className='text-xs' aria-live='polite'>
                        {isTyping ? (
                            <span className='font-medium text-brand-600'>typing…</span>
                        ) : isOnline ? (
                            <span className='font-medium text-emerald-600'>Online</span>
                        ) : (
                            <span className='text-slate-500'>Offline</span>
                        )}
                    </p>
                </div>
            </header>

            {/* messages */}
            <div className='chat-pattern scroll-thin flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6'>
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
                                        <p className={`mt-0.5 text-right text-[11px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                                            {timeLabel(message.createdAt)}
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

            {/* composer */}
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
        </div>
    )
}

export default MessageContainer
