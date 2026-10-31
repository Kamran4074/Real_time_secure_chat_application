import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

// Labelled input with optional leading icon, hint text and show/hide for passwords
const TextField = ({ id, label, icon: Icon, type = 'text', hint, ...props }) => {
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';

    return (
        <div>
            <label htmlFor={id} className='block text-sm font-medium text-slate-700 mb-1.5'>{label}</label>
            <div className='relative'>
                {Icon && (
                    <Icon aria-hidden className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400' />
                )}
                <input
                    id={id}
                    type={isPassword && show ? 'text' : type}
                    className={`w-full h-11 rounded-xl border border-slate-300 bg-white text-[15px] text-slate-900
                        placeholder:text-slate-400 shadow-sm transition
                        focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15
                        ${Icon ? 'pl-11' : 'pl-3.5'} ${isPassword ? 'pr-11' : 'pr-3.5'}`}
                    {...props}
                />
                {isPassword && (
                    <button type='button' onClick={() => setShow(s => !s)}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        className='absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-lg
                        text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition'>
                        {show ? <FiEyeOff /> : <FiEye />}
                    </button>
                )}
            </div>
            {hint && <p className='mt-1.5 text-xs text-slate-500'>{hint}</p>}
        </div>
    );
};

export default TextField;
