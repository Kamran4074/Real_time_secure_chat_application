import { HiChatBubbleLeftRight } from 'react-icons/hi2';

// Shown in the chat area while no conversation is open
const WelcomeScreen = ({ user }) => (
    <div className='chat-pattern flex h-full flex-col items-center justify-center bg-slate-50 px-6 text-center'>
        <span className='grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-xl shadow-brand-500/30'>
            <HiChatBubbleLeftRight className='h-10 w-10' />
        </span>
        <h2 className='mt-6 text-2xl font-bold tracking-tight text-slate-900'>
            Welcome, {(user?.fullname || user?.username || '').split(' ')[0]} 👋
        </h2>
        <p className='mt-2 max-w-sm text-slate-500'>
            Pick a conversation from the list, or search for someone by name or username to start a new chat.
        </p>
    </div>
);

export default WelcomeScreen;
