import { BsCheck, BsCheckAll } from 'react-icons/bs';

// ✓ sent, ✓✓ delivered, blue ✓✓ seen
const Ticks = ({ message }) => {
    if (message.seenAt) return <BsCheckAll aria-label='Seen' className='h-4 w-4 text-sky-300' />;
    if (message.deliveredAt) return <BsCheckAll aria-label='Delivered' className='h-4 w-4 text-brand-100' />;
    return <BsCheck aria-label='Sent' className='h-4 w-4 text-brand-100' />;
};

const timeLabel = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// One message. grouped = same sender as the one above (less space between them)
const MessageBubble = ({ message, mine, grouped }) => (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-3'}`}>
        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[70%] lg:max-w-[60%]
            ${mine
                ? 'rounded-br-md bg-brand-600 text-white'
                : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200'}`}>
            <p className='whitespace-pre-wrap break-words text-[15px] leading-relaxed'>{message.message}</p>
            <p className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                {timeLabel(message.createdAt)}
                {mine && <Ticks message={message} />}
            </p>
        </div>
    </div>
);

export default MessageBubble;
