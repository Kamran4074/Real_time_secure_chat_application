import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useConversation from '../store/useConversation';

// Block or unblock a user; keeps the shared blocked list in sync. Returns true on success.
const useBlockToggle = () => {
    const setBlocked = useConversation((s) => s.setBlocked);
    const [busy, setBusy] = useState(false);

    const toggle = async (user, block) => {
        setBusy(true);
        try {
            if (block) await axios.post(`/api/user/block/${user._id}`);
            else await axios.delete(`/api/user/block/${user._id}`);
            setBlocked(user._id, block);
            toast.success(`${user.fullname || user.username} ${block ? 'blocked' : 'unblocked'}`);
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Something went wrong');
            return false;
        } finally {
            setBusy(false);
        }
    };
    return { toggle, busy };
};

export default useBlockToggle;
