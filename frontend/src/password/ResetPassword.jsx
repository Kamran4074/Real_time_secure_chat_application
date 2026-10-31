import axios from 'axios';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import { resetPasswordSchema, isResetToken, fieldErrors, serverFieldErrors } from '../validation/authSchemas';

const InvalidLink = ({ message }) => (
    <AuthLayout title='Link not valid' subtitle='Reset links work once and expire after 30 minutes.'>
        <div role='alert' className='flex gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200'>
            <FiAlertCircle aria-hidden className='mt-0.5 h-5 w-5 shrink-0' />
            <p>{message}</p>
        </div>
        <Link to='/forgot-password'
            className='mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-700'>
            Request a new link
        </Link>
    </AuthLayout>
);

const ResetPassword = () => {
    const [params] = useSearchParams();
    const token = params.get('token');
    const navigate = useNavigate();
    const { setAuthUser } = useAuth();
    const [input, setInput] = useState({});
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [linkError, setLinkError] = useState(isResetToken(token) ? null : 'This reset link is incomplete or broken.');

    const handelInput = (e) => {
        setInput({ ...input, [e.target.id]: e.target.value });
        if (errors[e.target.id]) setErrors(({ [e.target.id]: _, ...rest }) => rest);
    };

    const handelSubmit = async (e) => {
        e.preventDefault();
        const result = resetPasswordSchema.safeParse(input);
        if (!result.success) {
            const found = fieldErrors(result.error);
            setErrors(found);
            document.getElementById(Object.keys(found)[0])?.focus();
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post('/api/auth/reset-password', { token, password: result.data.password });
            // every old session was logged out on the server, including this browser's
            localStorage.removeItem('chatapp');
            setAuthUser(null);
            toast.success(data.message);
            navigate('/login', { replace: true });
        } catch (error) {
            const data = error?.response?.data;
            const found = serverFieldErrors(data);
            if (found.token || /link/i.test(data?.message || '')) setLinkError(data.message);
            else setErrors(found);
            toast.error(data?.message || 'Could not reset the password');
        } finally {
            setLoading(false);
        }
    };

    if (linkError) return <InvalidLink message={linkError} />;

    return (
        <AuthLayout
            title='Set a new password'
            subtitle='You will be logged out on every device and can log in with the new password.'
            footer={<Link to='/login' className='font-semibold text-brand-600 hover:text-brand-700'>Back to log in</Link>}
        >
            <form onSubmit={handelSubmit} noValidate className='space-y-4'>
                <TextField id='password' type='password' label='New password' icon={FiLock} error={errors.password}
                    placeholder='Min. 6 chars' autoComplete='new-password' required maxLength={72} autoFocus
                    onChange={handelInput} />
                <TextField id='confpassword' type='password' label='Confirm new password' icon={FiLock} error={errors.confpassword}
                    placeholder='Repeat it' autoComplete='new-password' required onChange={handelInput} />
                <Button type='submit' loading={loading} className='!mt-6'>
                    {loading ? 'Saving…' : 'Update password'}
                </Button>
            </form>
        </AuthLayout>
    );
};

export default ResetPassword;
