import { FiSearch, FiX } from 'react-icons/fi';
import { Spinner } from '../../../shared/ui/Button';

// The people search input with its spinner / clear button
const SearchBox = ({ value, onChange, onSubmit, onClear, searching, showClear }) => {
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <form onSubmit={handleSubmit} role='search' className='relative mt-5'>
            <FiSearch aria-hidden className='pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400' />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                type='text'
                enterKeyHint='search'
                maxLength={50}
                placeholder='Search by name or @username'
                aria-label='Search people by name or username'
                className='h-11 w-full rounded-xl border border-transparent bg-slate-100 pl-11 pr-10 text-[15px] text-slate-900
                placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15'
            />
            <span className='absolute right-2 top-1/2 -translate-y-1/2'>
                {searching ? (
                    <span className='grid h-7 w-7 place-items-center'><Spinner className='border-slate-300 border-t-brand-600' /></span>
                ) : showClear && (
                    <button type='button' onClick={onClear} aria-label='Clear search'
                        className='grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-600'>
                        <FiX />
                    </button>
                )}
            </span>
        </form>
    );
};

export default SearchBox;
