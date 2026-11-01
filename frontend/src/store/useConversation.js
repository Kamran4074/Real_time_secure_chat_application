import {create} from "zustand";

const useConversation = create((set)=>({
    selectedConversation: null,
    setSelectedConversation:(selectedConversation)=>set({selectedConversation}),
    messages:[],
    setMessage:(messages)=>set({messages}),
    // append using latest state, so messages arriving during an await aren't lost
    addMessage:(message)=>set((state)=>({messages:[...state.messages, message]})),
    // ids of users I blocked (sidebar loads them; chat header / settings change them)
    blockedIds:[],
    setBlockedIds:(blockedIds)=>set({blockedIds}),
    setBlocked:(userId, blocked)=>set((state)=>({
        blockedIds: blocked
            ? [...new Set([...state.blockedIds, userId])]
            : state.blockedIds.filter(id => id !== userId)
    })),
    reset:()=>set({selectedConversation:null, messages:[], blockedIds:[]})
}));

export default useConversation
