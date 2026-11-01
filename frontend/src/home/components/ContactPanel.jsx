import { useEffect } from 'react';
import { FiX, FiSlash, FiUnlock } from 'react-icons/fi';
import useConversation from '../../store/useConversation';
import useBlockToggle from '../useBlockToggle';
import OnlineStatus from '../../components/ui/OnlineStatus';
import Avatar from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Button';

// Contact info drawer over the chat (opened from the chat header)
const ContactPanel = ({ user, online, onClose }) => {
    const blocked = useConversation((s) => s.blockedIds.includes(user._id));
    const { toggle, busy } = useBlockToggle();
    const name = user.fullname || user.username;

    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleBlock = () => {
        const question = blocked
            ? `Unblock ${name}? They will be able to message you again.`
            : `Block ${name}? They won't be able to message you, see when you're online or find you in search.`;
        if (window.confirm(question)) toggle(user, !blocked);
    };

    return (
        <div role='dialog' aria-modal='true' aria-labelledby='contact-title'
            className='absolute inset-0 z-20 flex flex-col bg-white animate-slide-in-right motion-reduce:animate-none'>
            <header className='flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4'>
                <button onClick={onClose} aria-label='Close contact info'
                    className='grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100'>
                    <FiX className='h-5 w-5' />
                </button>
                <h2 id='contact-title' className='text-lg font-semibold text-slate-900'>Contact info</h2>
            </header>

            <div className='scroll-thin flex-1 overflow-y-auto'>
                <section className='flex flex-col items-center bg-slate-50 px-5 py-8 text-center'>
                    <Avatar user={user} size='xl' online={online && !blocked} />
                    <p className='mt-4 text-xl font-semibold text-slate-900'>{name}</p>
                    <p className='text-slate-500'>@{user.username}</p>
                    {!blocked && <OnlineStatus online={online} className='mt-2 text-sm' />}
                </section>

                <section className='border-b border-slate-200 px-6 py-5'>
                    <h3 className='text-xs font-semibold uppercase tracking-wider text-slate-500'>About</h3>
                    <p className='mt-1.5 whitespace-pre-wrap break-words text-slate-800'>
                        {user.bio || <span className='text-slate-400'>No bio yet</span>}
                    </p>
                </section>

                <section className='px-3 py-3'>
                    <button onClick={handleBlock} disabled={busy}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold transition disabled:opacity-60
                            ${blocked ? 'text-emerald-700 hover:bg-emerald-50' : 'text-rose-600 hover:bg-rose-50'}`}>
                        {busy ? <Spinner className='border-slate-300 border-t-slate-600' />
                            : blocked ? <FiUnlock className='h-5 w-5' /> : <FiSlash className='h-5 w-5' />}
                        {blocked ? `Unblock ${name}` : `Block ${name}`}
                    </button>
                </section>
            </div>
        </div>
    );
};

export default ContactPanel;
