import { useAuth } from './features/auth';
import { SocketContextProvider } from './shared/realtime/SocketContext';

// One socket per logged-in session. shared/ doesn't know about auth, so the token is passed in here.
const RealtimeProvider = ({ children }) => {
    const { authUser } = useAuth();
    return <SocketContextProvider token={authUser?.token}>{children}</SocketContextProvider>;
};

export default RealtimeProvider;
