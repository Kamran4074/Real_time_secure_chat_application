import {create} from "zustand";

const useConversation = create((set)=>({
    selectedConversation: null,
    setSelectedConversation:(selectedConversation)=>set({selectedConversation}),
    messages:[],
    setMessage:(messages)=>set({messages}),
    // append using latest state, so messages arriving during an await aren't lost
    addMessage:(message)=>set((state)=>({messages:[...state.messages, message]})),
    reset:()=>set({selectedConversation:null, messages:[]})
}));

export default useConversation
