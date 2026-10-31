import axios from 'axios';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';

// OAuth 2.0 sign-in. Not wired up yet: set `enabled: true` once the backend
// route /api/auth/<provider> exists, and the button will redirect there.
const PROVIDERS = [
    { id: 'google', label: 'Google', Icon: FcGoogle, enabled: false },
    { id: 'github', label: 'GitHub', Icon: FaGithub, enabled: false },
];

const OAuthButtons = () => (
    <div className='grid grid-cols-2 gap-3'>
        {PROVIDERS.map(({ id, label, Icon, enabled }) => (
            <button
                key={id}
                type='button'
                disabled={!enabled}
                title={enabled ? `Continue with ${label}` : 'Coming soon'}
                onClick={() => { window.location.href = `${axios.defaults.baseURL}/api/auth/${id}`; }}
                className='relative h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300
                bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50
                disabled:cursor-not-allowed disabled:opacity-70'
            >
                <Icon className='w-5 h-5' />
                {label}
                {!enabled && (
                    <span className='absolute -top-2 -right-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white'>
                        Soon
                    </span>
                )}
            </button>
        ))}
    </div>
);

export const Divider = ({ text }) => (
    <div className='my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-slate-400'>
        <span className='h-px flex-1 bg-slate-200' />
        {text}
        <span className='h-px flex-1 bg-slate-200' />
    </div>
);

export default OAuthButtons;
