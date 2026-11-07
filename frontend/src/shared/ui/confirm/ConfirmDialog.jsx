import { useEffect, useId, useRef } from 'react';
import { FiHelpCircle } from 'react-icons/fi';

const TONES = {
    danger: {
        icon: 'bg-rose-50 text-rose-600 ring-rose-100',
        button: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500/30 shadow-rose-600/25',
    },
    primary: {
        icon: 'bg-brand-50 text-brand-600 ring-brand-100',
        button: 'bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500/30 shadow-brand-600/25',
    },
};

// In-app replacement for window.confirm: a small modal with a title, message and two buttons.
// Esc or a click on the backdrop cancels. Focus starts on Cancel for destructive actions,
// stays inside the dialog, and returns to where it was when the dialog closes.
const ConfirmDialog = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', icon: Icon = FiHelpCircle, onClose }) => {
    const titleId = useId();
    const messageId = useId();
    const cancelRef = useRef();
    const confirmRef = useRef();
    const styles = TONES[tone] || TONES.primary;

    useEffect(() => {
        const previous = document.activeElement;
        (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
        return () => previous?.focus?.();
    }, [tone]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose(false);
        }
        // keep Tab inside the two buttons
        if (e.key === 'Tab') {
            e.preventDefault();
            (document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus();
        }
    };

    return (
        <div onMouseDown={(e) => e.target === e.currentTarget && onClose(false)} onKeyDown={handleKeyDown}
            className='fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px] animate-fade-in motion-reduce:animate-none'>
            <div role='alertdialog' aria-modal='true' aria-labelledby={titleId} aria-describedby={message ? messageId : undefined}
                className='w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 animate-pop-in motion-reduce:animate-none'>
                <div className='flex gap-4'>
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ring-4 ${styles.icon}`}>
                        <Icon aria-hidden className='h-5 w-5' />
                    </span>
                    <div className='min-w-0 pt-0.5'>
                        <h2 id={titleId} className='text-lg font-semibold text-slate-900'>{title}</h2>
                        {message && <p id={messageId} className='mt-1.5 text-sm leading-relaxed text-slate-500'>{message}</p>}
                    </div>
                </div>
                <div className='mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end'>
                    <button ref={cancelRef} type='button' onClick={() => onClose(false)}
                        className='h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition
                        hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/25'>
                        {cancelLabel}
                    </button>
                    <button ref={confirmRef} type='button' onClick={() => onClose(true)}
                        className={`h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-md transition
                        focus:outline-none focus-visible:ring-4 ${styles.button}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
