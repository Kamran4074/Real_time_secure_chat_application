import { HiChatBubbleLeftRight } from 'react-icons/hi2';

const Logo = ({ light = false, size = 'md' }) => {
    const lg = size === 'lg';
    return (
        <span className='inline-flex items-center gap-2.5'>
            <span className={`grid place-items-center rounded-xl text-white ${lg ? 'w-11 h-11' : 'w-9 h-9'}
                ${light
                    ? 'bg-white/15 ring-1 ring-white/30'
                    : 'bg-gradient-to-br from-brand-500 to-violet-600 shadow-md shadow-brand-500/30'}`}>
                <HiChatBubbleLeftRight className={lg ? 'w-6 h-6' : 'w-5 h-5'} />
            </span>
            <span className={`font-bold tracking-tight ${lg ? 'text-2xl' : 'text-xl'} ${light ? 'text-white' : 'text-slate-900'}`}>
                ChatWave
            </span>
        </span>
    );
};

export default Logo;
