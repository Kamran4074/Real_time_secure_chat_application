import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocketContext=()=>{
    return useContext(SocketContext);
}

export const SocketContextProvider=({children})=>{
    const [socket , setSocket]= useState(null);
    const [onlineUser,setOnlineUser]=useState([]);
    const {authUser} = useAuth();
    useEffect(()=>{
        if(!authUser?.token){
            setSocket(null);
            setOnlineUser([]);
            return;
        }
        // server verifies this token and takes the userId from it
        const newSocket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',{
            auth:{
                token:authUser.token,
            }
        })
        newSocket.on("getOnlineUsers",(users)=>{
            setOnlineUser(users)
        });
        setSocket(newSocket);
        return()=>newSocket.close();
    },[authUser]);
    return(
    <SocketContext.Provider value={{socket , onlineUser}}>
        {children}
    </SocketContext.Provider>
    )
}
