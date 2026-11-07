import { useState } from 'react';
import { toast } from 'react-toastify';
import { FiLock, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import { ChangePasswordForm, logoutEverywhere } from '../../auth';
import { errorMessage } from '../../../shared/api/client';
import { useConfirm } from '../../../shared/ui/confirm/confirmContext';

// Password, linked sign-in methods and "log out everywhere"
const AccountSettings = ({ profile, onSignedOut }) => {
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const confirm = useConfirm();
    const hasPassword = profile?.hasPassword !== false;
    const linked = profile?.linkedAccounts || {};

    const handleLogoutEverywhere = async () => {
        const ok = await confirm({
            title: 'Log out from all devices?',
            message: "This signs you out everywhere, including this device. You'll need to sign in again.",
            confirmLabel: 'Log out everywhere',
            tone: 'danger',
            icon: FiLogOut,
        });
        if (!ok) return;
        setLoggingOut(true);
        try {
            const data = await logoutEverywhere();
            toast.info(data?.message);
            onSignedOut();
        } catch (error) {
            toast.error(errorMessage(error, 'Could not log out other devices'));
            setLoggingOut(false);
        }
    };

    return (
        <section className='border-t border-slate-200 px-2 py-4'>
            <h3 className='px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500'>Account</h3>

            <button onClick={() => setPasswordOpen((o) => !o)} aria-expanded={passwordOpen}
                className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-medium text-slate-800 transition hover:bg-slate-50'>
                <FiLock className='h-5 w-5 text-slate-500' />
                <span className='flex-1'>{hasPassword ? 'Change password' : 'Set a password'}</span>
                <FiChevronDown className={`h-5 w-5 text-slate-400 transition ${passwordOpen ? 'rotate-180' : ''}`} />
            </button>
            {passwordOpen && <ChangePasswordForm hasPassword={hasPassword} onDone={() => setPasswordOpen(false)} />}

            <div className='px-3 py-3'>
                <p className='text-sm font-medium text-slate-800'>Sign-in methods</p>
                <ul className='mt-2 space-y-1.5 text-sm'>
                    <li className='flex items-center justify-between'>
                        <span className='flex items-center gap-2 text-slate-700'><FiLock className='text-slate-500' /> Email &amp; password</span>
                        <span className={hasPassword ? 'font-medium text-emerald-600' : 'text-slate-400'}>{hasPassword ? 'On' : 'Not set'}</span>
                    </li>
                    <li className='flex items-center justify-between'>
                        <span className='flex items-center gap-2 text-slate-700'><FcGoogle /> Google</span>
                        <span className={linked.google ? 'font-medium text-emerald-600' : 'text-slate-400'}>{linked.google ? 'Linked' : 'Not linked'}</span>
                    </li>
                    <li className='flex items-center justify-between'>
                        <span className='flex items-center gap-2 text-slate-700'><FaGithub /> GitHub</span>
                        <span className={linked.github ? 'font-medium text-emerald-600' : 'text-slate-400'}>{linked.github ? 'Linked' : 'Not linked'}</span>
                    </li>
                </ul>
            </div>

            <button onClick={handleLogoutEverywhere} disabled={loggingOut}
                className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60'>
                <FiLogOut className='h-5 w-5' />
                {loggingOut ? 'Logging out…' : 'Log out from all devices'}
            </button>
        </section>
    );
};

export default AccountSettings;
