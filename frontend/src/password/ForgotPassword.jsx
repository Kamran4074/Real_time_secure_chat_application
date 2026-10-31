import axios from 'axios';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiMail, FiCheckCircle } from 'react-icons/fi';
import AuthLayout from '../components/AuthLayout';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import { forgotPasswordSchema, fieldErrors, serverFieldErrors } from '../validation/authSchemas';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [sentTo, setSentTo] = useState(null);

    const handelSubmit = async (e) => {
        e.preventDefault();
        const result = forgotPasswordSchema.safeParse({ email });
        if (!result.success) {
            setErrors(fieldErrors(result.error));
            document.getElementById('email')?.focus();
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/auth/forgot-password', result.data);
            setSentTo(result.data.email);
        } catch (error) {
            setErrors(serverFieldErrors(error?.response?.data));
            toast.error(error?.response?.data?.message || 'Could not send the reset link');
        } finally {
            setLoading(false);
        }
    };

    const footer = <>Remembered it?{' '}
        <Link to='/login' className='font-semibold text-brand-600 hover:text-brand-700'>Back to log in</Link>
    </>;

    if (sentTo) {
        return (
            <AuthLayout title='Check your email' subtitle='The link is valid for 30 minutes.' footer={footer}>
                <div role='status' className='flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200'>
                    <FiCheckCircle aria-hidden className='mt-0.5 h-5 w-5 shrink-0' />
                    <p>If an account exists for <strong className='break-all'>{sentTo}</strong>, we&apos;ve sent a link to reset the password.
                        Check your spam folder if it doesn&apos;t arrive in a few minutes.</p>
                </div>
                <button type='button' onClick={() => setSentTo(null)}
                    className='mt-6 text-sm font-semibold text-brand-600 hover:text-brand-700'>
                    Use a different email
                </button>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title='Forgot your password?'
            subtitle="Enter your account's email and we'll send you a reset link."
            footer={footer}
        >
            <form onSubmit={handelSubmit} noValidate className='space-y-4'>
                <TextField id='email' type='email' label='Email' icon={FiMail} error={errors.email}
                    placeholder='you@example.com' autoComplete='email' required autoFocus value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({}); }} />
                <Button type='submit' loading={loading} className='!mt-6'>
                    {loading ? 'Sending…' : 'Send reset link'}
                </Button>
            </form>
        </AuthLayout>
    );
};

export default ForgotPassword;
