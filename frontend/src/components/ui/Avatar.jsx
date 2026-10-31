import { useEffect, useState } from 'react';

const COLORS = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500'];
const SIZES = { sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-base', lg: 'w-14 h-14 text-lg' };
const DOT = { sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5' };

const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

// same name -> same colour every time
const colorFor = (name = '') =>
    COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length];

// Profile picture with a coloured-initials fallback and an optional online dot
const Avatar = ({ user, size = 'md', online = false }) => {
    const [failed, setFailed] = useState(false);
    const name = user?.fullname || user?.username || '';

    useEffect(() => setFailed(false), [user?.profilepic]);

    return (
        <span className={`relative inline-flex shrink-0 ${SIZES[size]}`}>
            {user?.profilepic && !failed ? (
                <img src={user.profilepic} alt='' onError={() => setFailed(true)}
                    className='w-full h-full rounded-full object-cover bg-slate-100' />
            ) : (
                <span className={`w-full h-full rounded-full grid place-items-center font-semibold text-white ${colorFor(name)}`}>
                    {initials(name)}
                </span>
            )}
            {online && (
                <span className={`absolute bottom-0 right-0 ${DOT[size]} rounded-full bg-emerald-500 ring-2 ring-white`}
                    aria-label='online' />
            )}
        </span>
    );
};

export default Avatar;
