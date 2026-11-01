import { useEffect, useState } from 'react';
import axios from 'axios';
import useConversation from '../../store/useConversation';
import useBlockToggle from '../useBlockToggle';
import Avatar from '../../components/ui/Avatar';
import logger from '../../utils/logger';

// List of people I blocked, with an Unblock button each
const BlockedContacts = () => {
    const [users, setUsers] = useState(null); // null = loading
    const blockedIds = useConversation((s) => s.blockedIds);
    const { toggle, busy } = useBlockToggle();

    useEffect(() => {
        axios.get('/api/user/blocked')
            .then(({ data }) => setUsers(data))
            .catch((error) => {
                logger.error('Could not load blocked users', error);
                setUsers([]);
            });
    }, []);

    // someone unblocked from the chat header disappears here too
    const shown = (users || []).filter((u) => blockedIds.includes(u._id));

    return (
        <section className='border-t border-slate-200 px-2 py-4'>
            <h3 className='px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500'>
                Blocked contacts{users ? ` · ${shown.length}` : ''}
            </h3>
            {users && shown.length === 0 && (
                <p className='px-3 text-sm text-slate-500'>You haven&apos;t blocked anyone.</p>
            )}
            <ul>
                {shown.map((user) => (
                    <li key={user._id} className='flex items-center gap-3 rounded-xl px-3 py-2'>
                        <Avatar user={user} size='sm' />
                        <span className='min-w-0 flex-1'>
                            <span className='block truncate text-sm font-semibold text-slate-900'>{user.fullname || user.username}</span>
                            <span className='block truncate text-xs text-slate-500'>@{user.username}</span>
                        </span>
                        <button onClick={() => toggle(user, false)} disabled={busy}
                            className='rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-60'>
                            Unblock
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default BlockedContacts;
