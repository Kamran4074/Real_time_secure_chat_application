import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './ui/Logo';
import { Spinner } from './ui/Button';

const ERRORS = {
    cancelled: 'Sign-in was cancelled.',
    invalid_state: 'Sign-in expired. Please try again.',
    email_not_verified: 'Your account needs a verified email address.',
    unavailable: 'This sign-in option is not available right now.',
    server_error: 'Could not sign you in. Please try again.',
};

// After Google/GitHub, the backend redirects to "/?oauth_code=..." (or "?oauth_error=...").
// The root path always loads, so this works on any host without SPA rewrites.
const OAuthHandler = () => {
    // read the URL during the first render, before route guards redirect away from "/"
    const [params] = useState(() => new URLSearchParams(window.location.search));
    const code = params.get('oauth_code');
    const error = params.get('oauth_error');
    const [busy, setBusy] = useState(Boolean(code));
    const { setAuthUser } = useAuth();
    const navigate = useNavigate();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current || (!code && !error)) return;
        handled.current = true;

        // remove the one-time code from the address bar and history
        window.history.replaceState(null, '', window.location.pathname);

        if (error) {
            toast.error(ERRORS[error] || ERRORS.server_error);
            return;
        }

        axios.post('/api/auth/oauth/exchange', { code })
            .then(({ data }) => {
                localStorage.setItem('chatapp', JSON.stringify(data));
                setAuthUser(data);
                toast.success(`Welcome, ${(data.fullname || data.username).split(' ')[0]}!`);
                navigate('/', { replace: true });
            })
            .catch((err) => {
                toast.error(err?.response?.data?.message || ERRORS.server_error);
                navigate('/login', { replace: true });
            })
            .finally(() => setBusy(false));
    }, [code, error, navigate, setAuthUser]);

    if (!busy) return null;

    return (
        <div className='fixed inset-0 z-[60] grid place-items-center bg-white' role='status' aria-live='polite'>
            <div className='flex flex-col items-center gap-5'>
                <Logo size='lg' />
                <div className='flex items-center gap-3 text-slate-600'>
                    <Spinner className='border-slate-200 border-t-brand-600' />
                    Signing you in…
                </div>
            </div>
        </div>
    );
};

export default OAuthHandler;
