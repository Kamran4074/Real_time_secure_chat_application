import { BsCheck, BsCheckAll } from 'react-icons/bs';
import isEmojiOnly from '../emoji/isEmojiOnly';

// ✓ sent, ✓✓ delivered, blue ✓✓ seen. onLight: drawn on a light background (big-emoji messages)
const Ticks = ({ message, onLight }) => {
    const grey = onLight ? 'text-slate-400' : 'text-brand-100';
    if (message.seenAt) return <BsCheckAll aria-label='Seen' className={`h-4 w-4 ${onLight ? 'text-sky-500' : 'text-sky-300'}`} />;
    if (message.deliveredAt) return <BsCheckAll aria-label='Delivered' className={`h-4 w-4 ${grey}`} />;
    return <BsCheck aria-label='Sent' className={`h-4 w-4 ${grey}`} />;
};

const timeLabel = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// One message. grouped = same sender as the one above (less space between them).
// A message of only 1-3 emoji is shown large, without a bubble.
const MessageBubble = ({ message, mine, grouped }) => {
    const bigEmoji = isEmojiOnly(message.message);
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-3'}`}>
            {bigEmoji ? (
                <div className={`flex max-w-[80%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    <p className='text-[2.75rem] leading-tight' data-testid='big-emoji'>{message.message}</p>
                    <p className='flex items-center gap-1 rounded-full bg-white/80 px-2 text-[11px] text-slate-400'>
                        {timeLabel(message.createdAt)}
                        {mine && <Ticks message={message} onLight />}
                    </p>
                </div>
            ) : (
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
            )}
        </div>
    );
};

export default MessageBubble;
