import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { loadSession, saveSession, clearSession } from '../../shared/lib/session';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// The logged-in user (the saved session), kept in sync with localStorage
export const AuthContextProvider = ({ children }) => {
    const [authUser, setAuthUser] = useState(loadSession);

    // after login / register / OAuth: the full login response becomes the session
    const signIn = useCallback((session) => {
        saveSession(session);
        setAuthUser(session);
    }, []);

    // forget the session on this device
    const signOut = useCallback(() => {
        clearSession();
        setAuthUser(null);
    }, []);

    // change some fields (profile edit, fresh token) and keep the rest
    const updateSession = useCallback((changes) => {
        const next = { ...loadSession(), ...changes };
        saveSession(next);
        setAuthUser(next);
    }, []);

    const value = useMemo(() => ({ authUser, signIn, signOut, updateSession }), [authUser, signIn, signOut, updateSession]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
