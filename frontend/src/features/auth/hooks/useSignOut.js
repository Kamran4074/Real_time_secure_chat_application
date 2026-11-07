import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import useConversation from '../../../shared/store/useConversation';

// Forget everything about the session on this device and go to the login page
const useSignOut = () => {
    const { signOut } = useAuth();
    const reset = useConversation((s) => s.reset);
    const navigate = useNavigate();

    return useCallback(() => {
        reset();
        signOut();
        navigate('/login');
    }, [reset, signOut, navigate]);
};

export default useSignOut;
