// The ONLY code that touches the saved session in localStorage.
// A session is the login response: { _id, fullname, username, profilepic, email, token }.
const KEY = 'chatapp';

// null when there is none, it is unreadable, or it has no token (old sessions can't authenticate the socket)
export const loadSession = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(KEY));
        return stored?.token ? stored : null;
    } catch {
        return null;
    }
};

export const saveSession = (session) => localStorage.setItem(KEY, JSON.stringify(session));

export const clearSession = () => localStorage.removeItem(KEY);

export const hasSavedSession = () => localStorage.getItem(KEY) !== null;
