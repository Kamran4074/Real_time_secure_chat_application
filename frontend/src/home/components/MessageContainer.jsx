import React, { useEffect, useState,useRef  } from 'react'
import userConversation from '../../Zustans/useConversation';
import { useAuth } from '../../context/AuthContext';
import { TiMessages } from "react-icons/ti";
import { IoArrowBackSharp, IoSend } from 'react-icons/io5';
import axios from 'axios';
import { useSocketContext } from '../../context/SocketContext';
import notify from '../../assets/sound/notification.mp3';

const MessageContainer = ({ onBackUser }) => {
    const { messages, selectedConversation, setMessage, setSelectedConversation } = userConversation();
    const {socket, onlineUser} = useSocketContext();
    const { authUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sending , setSending] = useState(false);
    const [sendData , setSendData] = useState("")
    const [isTyping, setIsTyping] = useState(false);
    const lastMessageRef = useRef();
    const typingTimeoutRef = useRef(null);

    const isOnline = onlineUser.includes(selectedConversation?._id);

    useEffect(()=>{
      const handleNewMessage = (newMessage)=>{
        // Only add message if it's for the current conversation
        if(selectedConversation?._id === newMessage.senderId || selectedConversation?._id === newMessage.recieverId){
          const sound = new Audio(notify);
          sound.play();
          setMessage([...messages,newMessage])
        }
      }

      socket?.on("newMessage", handleNewMessage)

      return ()=> socket?.off("newMessage", handleNewMessage);
    },[socket,setMessage,messages,selectedConversation])

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
        setTimeout(()=>{
            lastMessageRef?.current?.scrollIntoView({behavior:"smooth"})
        },100)
    },[messages])

    useEffect(() => {
        const getMessages = async () => {
            setLoading(true);
            try {
                const get = await axios.get(`/api/message/${selectedConversation?._id}`);
                const data = await get.data;
                if (data.success === false) {
                    setLoading(false);
                    console.log(data.message);
                }
                setLoading(false);
                setMessage(data);
            } catch (error) {
                setLoading(false);
                console.log(error);

            }
        }

        if (selectedConversation?._id) getMessages();
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
        
        // Stop typing indicator when sending
        socket?.emit('stopTyping', {receiverId: selectedConversation._id});
        if(typingTimeoutRef.current){
          clearTimeout(typingTimeoutRef.current);
        }
        
        setSending(true);
        try {
            const res =await axios.post(`/api/message/send/${selectedConversation?._id}`,{messages:sendData});
            const data = await res.data;
            if (data.success === false) {
                setSending(false);
                console.log(data.message);
            }
            setSending(false);
            setSendData('')
            setMessage([...messages,data])
        } catch (error) {
            setSending(false);
            console.log(error);
        }
    }

    return (
        <div className='md:min-w-[500px] h-[99%] flex flex-col py-2'>
        {selectedConversation === null ? (
          <div className='flex items-center justify-center w-full h-full'>
            <div className='px-4 text-center text-2xl text-gray-950 font-semibold 
            flex flex-col items-center gap-2'>
              <p className='text-2xl'>Welcome!!👋 {authUser.username}😉</p>
              <p className="text-lg">Select a chat to start messaging</p>
              <TiMessages className='text-6xl text-center' />
            </div>
          </div>
        ) : (
          <>
            <div className='flex justify-between gap-1 bg-sky-600 md:px-2 rounded-lg h-10 md:h-12'>
              <div className='flex gap-2 md:justify-between items-center w-full'>
                <div className='md:hidden ml-1 self-center'>
                  <button onClick={() => onBackUser(true)} className='bg-white rounded-full px-2 py-1
                   self-center'>
                    <IoArrowBackSharp size={25} />
                  </button>
                </div>
                <div className='flex justify-between mr-2 gap-2'>
                  <div className={`avatar ${isOnline ? 'online' : 'offline'}`}>
                    <div className='w-6 h-6 md:w-10 md:h-10 rounded-full'>
                      <img 
                        className='rounded-full w-full h-full cursor-pointer' 
                        src={selectedConversation?.profilepic || `https://avatar.iran.liara.run/public?username=${selectedConversation?.username}`}
                        alt='user avatar'
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${selectedConversation?.username}&background=random`;
                        }}
                      />
                    </div>
                  </div>
                  <div className='flex flex-col justify-center'>
                    <span className='text-gray-950 self-center text-sm md:text-xl font-bold'>
                      {selectedConversation?.username}
                    </span>
                    {isTyping ? (
                      <span className='text-xs text-blue-900 font-semibold underline decoration-blue-900'>typing...</span>
                    ) : isOnline ? (
                      <span className='text-xs text-green-900 font-semibold'>online</span>
                    ) : (
                      <span className='text-xs text-gray-700'>offline</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
      
            <div className='flex-1 overflow-auto'>
              {loading && (
                <div className="flex w-full h-full flex-col items-center justify-center 
                gap-4 bg-transparent">
                  <div className="loading loading-spinner"></div>
                </div>
              )}
              {!loading && messages?.length === 0 && (
                <p className='text-center text-white items-center'>Send a message to 
                start Conversation</p>
              )}
              {!loading && messages?.length > 0 && messages?.map((message) => (
                <div className='text-white' key={message?._id} ref={lastMessageRef}>
                  <div className={`chat ${message.senderId === authUser._id ? 'chat-end' : 'chat-start'}`}>
                    <div className='chat-image avatar'></div>
                    <div className={`chat-bubble ${message.senderId === authUser._id ? 'bg-sky-600' : ''

                    }`}>
                      {message?.message}
                    </div>
                    <div className="chat-footer text-[10px] opacity-80">
                      {new Date(message?.createdAt).toLocaleDateString('en-IN')}
                      {new Date(message?.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute:
                         'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handelSubmit} className='rounded-full text-black'>
            <div className='w-full rounded-full flex items-center bg-white'>
              <input value={sendData} onChange={handelMessages} required id='message' type='text' 
              className='w-full bg-transparent outline-none px-4 rounded-full'/>
              <button type='submit'>
                {sending ? <div className='loading loading-spinner'></div>:
                <IoSend size={25}
                className='text-sky-700 cursor-pointer rounded-full bg-gray-800 w-10 h-auto p-1'/>
                }
              </button>
            </div>
            </form>
          </>
        )}
      </div>
    )
}

export default MessageContainer