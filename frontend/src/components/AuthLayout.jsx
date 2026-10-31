import { FiZap, FiActivity, FiShield } from 'react-icons/fi';
import Logo from './ui/Logo';
import TypingDots from './ui/TypingDots';

const FEATURES = [
    { Icon: FiZap, title: 'Instant delivery', text: 'Messages arrive in real time over WebSockets.' },
    { Icon: FiActivity, title: 'Live presence', text: 'See who is online and when they are typing.' },
    { Icon: FiShield, title: 'Secure sessions', text: 'Hashed passwords and revocable login tokens.' },
];

// Mock conversation shown on the brand panel
const ChatPreview = () => (
    <div className='mt-10 space-y-3 rounded-2xl bg-white/10 p-5 shadow-2xl ring-1 ring-white/20 backdrop-blur-md'>
        <div className='flex items-center gap-3 border-b border-white/15 pb-3'>
            <span className='grid h-9 w-9 place-items-center rounded-full bg-amber-300 text-sm font-semibold text-amber-900'>AK</span>
            <div>
                <p className='text-sm font-semibold'>Aisha Khan</p>
                <p className='text-xs text-emerald-200'>Online</p>
            </div>
        </div>
        <p className='w-fit max-w-[80%] rounded-2xl rounded-bl-md bg-white px-4 py-2 text-sm text-slate-800'>
            Hey! Did the design review go well? 🎨
        </p>
        <p className='ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-brand-900/50 px-4 py-2 text-sm ring-1 ring-white/20'>
            Shipped it! Everyone loved the new look 🚀
        </p>
        <span className='flex w-fit rounded-2xl rounded-bl-md bg-white px-4 py-3'>
            <TypingDots />
        </span>
    </div>
);

// Split screen: brand panel on the left (desktop), form on the right
const AuthLayout = ({ title, subtitle, children, footer }) => (
    <div className='grid min-h-[100dvh] w-full bg-white lg:grid-cols-[1.05fr_1fr]'>
        <aside className='relative hidden flex-col justify-between gap-10 overflow-hidden bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex xl:p-16'>
            <div aria-hidden className='absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl' />
            <div aria-hidden className='absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-fuchsia-400/30 blur-3xl' />

            <div className='relative'><Logo light /></div>

            <div className='relative max-w-md'>
                <h2 className='text-4xl font-bold leading-tight tracking-tight xl:text-5xl'>
                    Conversations that keep up with you.
                </h2>
                <p className='mt-4 text-lg text-white/80'>
                    Chat one-on-one in real time, see who’s online, and pick up right where you left off.
                </p>
                <ChatPreview />
            </div>

            <ul className='relative grid max-w-md gap-5'>
                {FEATURES.map(({ Icon, title: heading, text }) => (
                    <li key={heading} className='flex gap-4'>
                        <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25'>
                            <Icon className='h-5 w-5' />
                        </span>
                        <div>
                            <p className='font-semibold'>{heading}</p>
                            <p className='text-sm text-white/75'>{text}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </aside>

        <main className='flex items-center justify-center bg-slate-50 px-5 py-10 sm:px-10 lg:bg-white'>
            <div className='w-full max-w-[420px]'>
                <div className='mb-8 flex justify-center lg:hidden'><Logo size='lg' /></div>
                <div className='rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-200 sm:p-8 lg:p-0 lg:shadow-none lg:ring-0'>
                    <h1 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]'>{title}</h1>
                    <p className='mt-1.5 text-slate-500'>{subtitle}</p>
                    <div className='mt-8'>{children}</div>
                </div>
                {footer && <p className='mt-6 text-center text-sm text-slate-600'>{footer}</p>}
            </div>
        </main>
    </div>
);

export default AuthLayout;
