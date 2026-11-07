import { useState } from 'react';
import { toast } from 'react-toastify';
import useConversation from '../../../shared/store/useConversation';
import { errorMessage } from '../../../shared/api/client';
import { blockUser, unblockUser } from '../api';

// Block or unblock a user; keeps the shared blocked list in sync. Returns true on success.
const useBlockToggle = () => {
    const setBlocked = useConversation((s) => s.setBlocked);
    const [busy, setBusy] = useState(false);

    const toggle = async (user, block) => {
        setBusy(true);
        try {
            await (block ? blockUser(user._id) : unblockUser(user._id));
            setBlocked(user._id, block);
            toast.success(`${user.fullname || user.username} ${block ? 'blocked' : 'unblocked'}`);
            return true;
        } catch (error) {
            toast.error(errorMessage(error, 'Something went wrong'));
            return false;
        } finally {
            setBusy(false);
        }
    };
    return { toggle, busy };
};

export default useBlockToggle;
