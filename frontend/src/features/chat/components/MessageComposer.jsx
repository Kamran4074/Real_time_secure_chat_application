import { useEffect, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { Spinner } from '../../../shared/ui/Button';

const MAX_LENGTH = 2000; // same as the backend

// The message input. Mounted fresh for every chat (key = contact id), so the draft starts empty.
// onSend(text) resolves true when sent; onTyping(value) / onStopTyping drive the typing indicator.
const MessageComposer = ({ name, onSend, sending, onTyping, onStopTyping }) => {
    const [text, setText] = useState('');
    const inputRef = useRef();
    const nearLimit = text.length > MAX_LENGTH - 200;

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = (e) => {
        setText(e.target.value);
        onTyping(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;
        onStopTyping(); // sending ends the typing burst right away
        if (await onSend(text)) setText('');
        inputRef.current?.focus();
    };

    return (
        <form onSubmit={handleSubmit} className='flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white p-3 sm:px-5'>
            <div className='relative flex-1'>
                <input
                    ref={inputRef}
                    value={text}
                    onChange={handleChange}
                    maxLength={MAX_LENGTH}
                    autoComplete='off'
                    placeholder={`Message ${name}`}
                    aria-label='Type a message'
                    className={`h-12 w-full rounded-full border border-transparent bg-slate-100 pl-5 text-[15px] text-slate-900
                    placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15
                    ${nearLimit ? 'pr-24' : 'pr-5'}`}
                />
                {nearLimit && (
                    <span className='absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400'>
                        {text.length}/{MAX_LENGTH}
                    </span>
                )}
            </div>
            <button type='submit' disabled={!text.trim() || sending} aria-label='Send message'
                className='grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/30 transition
                hover:bg-brand-700 active:scale-95 disabled:bg-slate-300 disabled:shadow-none'>
                {sending ? <Spinner /> : <FiSend className='-ml-0.5 h-5 w-5' />}
            </button>
        </form>
    );
};

export default MessageComposer;
