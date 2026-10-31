import { createContext , useContext ,useState } from "react";

const AuthContext = createContext();

export  const useAuth =()=>{
    return useContext(AuthContext)
}

export const AuthContextProvider =({children})=>{
    const [authUser , setAuthUser] = useState(()=>{
        try {
            const stored = JSON.parse(localStorage.getItem('chatapp'));
            // old sessions saved without a token can't authenticate the socket -> login again
            return stored?.token ? stored : null;
        } catch {
            return null;
        }
    });

    return <AuthContext.Provider value={{authUser ,setAuthUser}}>
        {children}
    </AuthContext.Provider>
}