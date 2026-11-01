import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiLock, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import TextField from '../../components/ui/TextField';
import Button from '../../components/ui/Button';
import { changePasswordSchema, fieldErrors, serverFieldErrors } from '../../validation/authSchemas';

const EMPTY = { currentPassword: '', newPassword: '', confpassword: '' };

const ChangePasswordForm = ({ hasPassword, onDone }) => {
    const { authUser, setAuthUser } = useAuth();
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const setField = (field) => (e) => {
        setForm((f) => ({ ...f, [field]: e.target.value }));
        setErrors((err) => ({ ...err, [field]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = changePasswordSchema(hasPassword).safeParse(form);
        if (!result.success) return setErrors(fieldErrors(result.error));

        setSaving(true);
        try {
            const { currentPassword, newPassword } = result.data;
            const { data } = await axios.post('/api/auth/change-password',
                hasPassword ? { currentPassword, newPassword } : { newPassword });
            // other devices are logged out; this one continues with the fresh token
            const next = { ...authUser, token: data.token };
            localStorage.setItem('chatapp', JSON.stringify(next));
            setAuthUser(next);
            toast.success(`${data.message}. Other devices were logged out.`);
            setForm(EMPTY);
            onDone();
        } catch (error) {
            const data = error?.response?.data;
            setErrors(serverFieldErrors(data));
            toast.error(data?.message || 'Could not change password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className='space-y-4 px-3 pb-4 pt-1'>
            {hasPassword && (
                <TextField id='current-password' label='Current password' type='password' autoComplete='current-password'
                    value={form.currentPassword} onChange={setField('currentPassword')} error={errors.currentPassword} />
            )}
            <TextField id='new-password' label='New password' type='password' autoComplete='new-password'
                value={form.newPassword} onChange={setField('newPassword')} error={errors.newPassword}
                hint='At least 6 characters' />
            <TextField id='confirm-new-password' label='Confirm new password' type='password' autoComplete='new-password'
                value={form.confpassword} onChange={setField('confpassword')} error={errors.confpassword} />
            <Button type='submit' loading={saving}>{hasPassword ? 'Change password' : 'Set password'}</Button>
        </form>
    );
};

// Password, linked sign-in methods and "log out everywhere"
const AccountSettings = ({ profile, onSignedOut }) => {
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const hasPassword = profile?.hasPassword !== false;
    const linked = profile?.linkedAccounts || {};

    const logoutEverywhere = async () => {
        if (!window.confirm('Log out from all devices, including this one?')) return;
        setLoggingOut(true);
        try {
            const { data } = await axios.post('/api/auth/logout-all');
            toast.info(data?.message);
            onSignedOut();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Could not log out other devices');
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

            <button onClick={logoutEverywhere} disabled={loggingOut}
                className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60'>
                <FiLogOut className='h-5 w-5' />
                {loggingOut ? 'Logging out…' : 'Log out from all devices'}
            </button>
        </section>
    );
};

export default AccountSettings;
