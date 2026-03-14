import React, { useEffect, useState } from 'react'
import { FaSearch } from 'react-icons/fa'
import axios from 'axios';
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom'
import { IoArrowBackSharp } from 'react-icons/io5';
import { BiLogOut } from "react-icons/bi";
import userConversation from '../../Zustans/useConversation';
import { useSocketContext } from '../../context/SocketContext';

const Sidebar = ({ onSelectUser }) => {

    const navigate = useNavigate();
    const { authUser, setAuthUser } = useAuth();
    const [searchInput, setSearchInput] = useState('');
    const [searchUser, setSearchuser] = useState([]);
    const [chatUser, setChatUser] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUserId, setSetSelectedUserId] = useState(null);
    const [unreadMessages, setUnreadMessages] = useState({});
    const {messages , setMessage, selectedConversation ,  setSelectedConversation} = userConversation();
    const { onlineUser , socket} = useSocketContext();

    const nowOnline = chatUser.map((user)=>(user._id));
    //chats function
    const isOnline = nowOnline.map(userId => onlineUser.includes(userId));

    useEffect(()=>{
        socket?.on("newMessage",(newMessage)=>{
            // Only count if message is not from selected conversation
            if(newMessage.senderId !== selectedUserId) {
                setUnreadMessages(prev => ({
                    ...prev,
                    [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1
                }));
            }
        })
        return ()=> socket?.off("newMessage");
    },[socket,messages,selectedUserId])

    //show user with u chatted
    useEffect(() => {
        const chatUserHandler = async () => {
            setLoading(true)
            try {
                const chatters = await axios.get(`/api/user/currentchatters`)
                const data = chatters.data;
                if (data.success === false) {
                    setLoading(false)
                    console.log(data.message);
                }
                setLoading(false)
                setChatUser(data)

            } catch (error) {
                setLoading(false)
                console.log(error);
            }
        }
        chatUserHandler()
    }, [])
    
    //show user from the search result
    const handelSearchSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        try {
            const search = await axios.get(`/api/user/search?search=${searchInput}`);
            const data = search.data;
            if (data.success === false) {
                setLoading(false)
                console.log(data.message);
            }
            setLoading(false)
            if (data.length === 0) {
                toast.info("User Not Found")
            } else {
                setSearchuser(data)
            }
        } catch (error) {
            setLoading(false)
            console.log(error);
        }
    }

    //show which user is selected
    const handelUserClick = (user) => {
        onSelectUser(user);
        setSelectedConversation(user);
        setSetSelectedUserId(user._id);
        // Clear unread count for this user
        setUnreadMessages(prev => ({
            ...prev,
            [user._id]: 0
        }));
    }

    //back from search result
    const handSearchback = () => {
        setSearchuser([]);
        setSearchInput('')
    }

    //logout
    const handelLogOut = async () => {
        const confirmLogout = window.confirm("Do you want to logout?");
        if (confirmLogout) {
            setLoading(true)
            try {
                const logout = await axios.post('/api/auth/logout')
                const data = logout.data;
                if (data?.success === false) {
                    setLoading(false)
                    console.log(data?.message);
                }
                toast.info(data?.message)
                localStorage.removeItem('chatapp')
                setAuthUser(null)
                setLoading(false)
                navigate('/login')
            } catch (error) {
                setLoading(false)
                console.log(error);
            }
        }
    }

    return (
        <div className='h-full w-auto px-1 flex flex-col'>
            <div className='flex justify-between gap-2'>
                <form onSubmit={handelSearchSubmit} className='w-auto flex items-center justify-between bg-white rounded-full '>
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        type='text'
                        className='px-4 w-auto bg-transparent outline-none rounded-full'
                        placeholder='search user'
                    />
                    <button className='btn btn-circle bg-sky-700 hover:bg-gray-950'>
                        <FaSearch />
                    </button>
                </form>
                <img
                    onClick={() => navigate('/')}
                    src={authUser?.profilepic}
                    className='self-center h-12 w-12 hover:scale-110 cursor-pointer rounded-full' />
            </div>
            <div className='divider px-3'></div>
            {searchUser?.length > 0 ? (
                <>
                    <div className="flex-1 overflow-y-auto scrollbar">
                        <div className='w-auto'>
                            {searchUser.map((user, index) => (
                                <div key={user._id}>
                                    <div
                                        onClick={() => handelUserClick(user)}
                                        className={`flex gap-3 
                                                items-center rounded 
                                                p-2 py-1 cursor-pointer
                                                ${selectedUserId === user?._id ? 'bg-sky-500' : ''
                                            } `}>
                                        {/*Socket is Online*/}
                                        <div className={`avatar ${isOnline[index] ? 'online':''}`}>
                                            <div className="w-12 rounded-full">
                                                <img 
                                                    src={user.profilepic || `https://avatar.iran.liara.run/public?username=${user.username}`} 
                                                    alt='user.img'
                                                    onError={(e) => {
                                                        e.target.src = `https://ui-avatars.com/api/?name=${user.username}&background=random`;
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className='flex flex-col flex-1'>
                                            <p className='font-bold text-gray-950'>{user.username}</p>
                                        </div>
                                    </div>
                                    <div className='divider divide-solid px-3 h-[1px]'></div>
                                </div>
                            )
                            )}
                        </div>
                    </div>
                    <div className='px-1 py-2 flex gap-2 items-center border-t border-gray-600'>
                        <button onClick={handSearchback} className='bg-white rounded-full px-2 py-1'>
                            <IoArrowBackSharp size={25} />
                        </button>
                        <p className='text-sm'>Back</p>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto scrollbar">
                        <div className='w-auto'>
                            {chatUser.length === 0 ? (
                                <>
                                    <div className='font-bold items-center flex flex-col text-xl text-yellow-500'>
                                        <h1>Why are you Alone!!🤔</h1>
                                        <h1>Search username to chat</h1>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {chatUser.map((user, index) => (
                                        <div key={user._id}>
                                            <div
                                                onClick={() => handelUserClick(user)}
                                                className={`flex gap-3 
                                                items-center rounded 
                                                p-2 py-1 cursor-pointer
                                                ${selectedUserId === user?._id ? 'bg-sky-500' : ''
                                                    } `}>

                                                {/*Socket is Online*/}
                                                <div className={`avatar ${isOnline[index] ? 'online':''}`}>
                                                    <div className="w-12 rounded-full">
                                                        <img 
                                                            src={user.profilepic || `https://avatar.iran.liara.run/public?username=${user.username}`} 
                                                            alt='user.img'
                                                            onError={(e) => {
                                                                e.target.src = `https://ui-avatars.com/api/?name=${user.username}&background=random`;
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className='flex flex-col flex-1'>
                                                    <p className='font-bold text-gray-950'>{user.username}</p>
                                                </div>
                                                <div>
                                                    {unreadMessages[user._id] > 0 && (
                                                        <div className="rounded-full bg-green-600 text-sm text-white px-2 py-1 font-semibold min-w-[28px] text-center">
                                                            {unreadMessages[user._id] <= 4 
                                                                ? `${unreadMessages[user._id]} ${unreadMessages[user._id] === 1 ? 'message' : 'messages'}`
                                                                : `+${unreadMessages[user._id]} messages`
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className='divider divide-solid px-3 h-[1px]'></div>
                                        </div>
                                    )
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    <div className='px-1 py-2 flex gap-2 items-center border-t border-gray-600'>
                        <button onClick={handelLogOut} className='bg-sky-600 hover:bg-red-600 p-2 cursor-pointer text-white rounded-lg transition-colors'>
                            <BiLogOut size={25} />
                        </button>
                        <p className='text-sm font-semibold text-gray-950'>Logout</p>
                    </div>
                </>
            )}
        </div>
    )
}

export default Sidebar