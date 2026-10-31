import { useEffect, useState } from 'react';
import axios from 'axios';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import { Spinner } from './ui/Button';

// OAuth 2.0 sign-in. A button is enabled when the backend reports that provider
// as configured (GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET).
const PROVIDERS = [
    { id: 'google', label: 'Google', Icon: FcGoogle },
    { id: 'github', label: 'GitHub', Icon: FaGithub },
];

const OAuthButtons = () => {
    const [enabled, setEnabled] = useState([]);
    const [redirecting, setRedirecting] = useState(null);

    useEffect(() => {
        axios.get('/api/auth/providers')
            .then(({ data }) => setEnabled(data.providers || []))
            .catch(() => setEnabled([]));
    }, []);

    const signIn = (id) => {
        setRedirecting(id);
        // full-page redirect: the backend sends the user on to Google/GitHub
        window.location.href = `${axios.defaults.baseURL}/api/auth/${id}`;
    };

    return (
        <div className='grid grid-cols-2 gap-3'>
            {PROVIDERS.map(({ id, label, Icon }) => {
                const on = enabled.includes(id);
                return (
                    <button
                        key={id}
                        type='button'
                        disabled={!on || redirecting !== null}
                        title={on ? `Continue with ${label}` : 'Coming soon'}
                        onClick={() => signIn(id)}
                        className='relative h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300
                        bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400
                        focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20
                        disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-white'
                    >
                        {redirecting === id
                            ? <Spinner className='border-slate-300 border-t-slate-700' />
                            : <Icon className='w-5 h-5' />}
                        {label}
                        {!on && (
                            <span className='absolute -top-2 -right-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white'>
                                Soon
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export const Divider = ({ text }) => (
    <div className='my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-slate-400'>
        <span className='h-px flex-1 bg-slate-200' />
        {text}
        <span className='h-px flex-1 bg-slate-200' />
    </div>
);

export default OAuthButtons;
