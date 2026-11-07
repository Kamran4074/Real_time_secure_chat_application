import { useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import EMOJI_CATEGORIES from '../emoji/emojiData';

const ALL_EMOJI = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
const labelOf = (keywords) => keywords.split(' ').slice(0, 2).join(' ');

// Emoji panel above the message box: search, category tabs and a grid.
// Stays open while picking several; Esc or a click outside (except on `toggleRef`) closes it.
const EmojiPicker = ({ onPick, onClose, toggleRef }) => {
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState(EMOJI_CATEGORIES[0].id);
    const panelRef = useRef();
    const searchRef = useRef();
    const gridRef = useRef();

    useEffect(() => {
        searchRef.current?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            onClose();
        };
        const onPointer = (e) => {
            if (panelRef.current?.contains(e.target) || toggleRef?.current?.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('mousedown', onPointer);
        };
    }, [onClose, toggleRef]);

    const searching = query.trim() !== '';
    const results = useMemo(() => {
        const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return words.length
            ? ALL_EMOJI.filter(([, keywords]) => words.every((w) => keywords.includes(w)))
            : EMOJI_CATEGORIES.find((c) => c.id === activeId).emojis;
    }, [query, activeId]);

    const selectCategory = (id) => {
        setQuery('');
        setActiveId(id);
        gridRef.current?.scrollTo?.({ top: 0 });
    };

    const activeLabel = EMOJI_CATEGORIES.find((c) => c.id === activeId).label;

    return (
        <div ref={panelRef} role='dialog' aria-label='Emoji picker'
            className='absolute bottom-full left-2 z-30 mb-2 flex h-80 w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden
            rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 animate-pop-in motion-reduce:animate-none sm:left-5'>
            <div className='relative px-3 pt-3'>
                <FiSearch aria-hidden className='pointer-events-none absolute left-6 top-1/2 mt-1.5 h-4 w-4 -translate-y-1/2 text-slate-400' />
                <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} type='search'
                    placeholder='Search emoji' aria-label='Search emoji'
                    className='h-9 w-full rounded-lg border border-transparent bg-slate-100 pl-9 pr-3 text-sm text-slate-900
                    placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15' />
            </div>

            <div role='tablist' aria-label='Emoji categories' className='flex gap-0.5 overflow-x-auto px-2 pt-2 scroll-thin'>
                {EMOJI_CATEGORIES.map((c) => {
                    const selected = !searching && c.id === activeId;
                    return (
                        <button key={c.id} type='button' role='tab' aria-selected={selected} aria-label={c.label} title={c.label}
                            onClick={() => selectCategory(c.id)}
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg transition
                                ${selected ? 'bg-brand-50 ring-1 ring-brand-100' : 'opacity-60 hover:bg-slate-100 hover:opacity-100'}`}>
                            {c.icon}
                        </button>
                    );
                })}
            </div>

            <p className='px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500'>
                {searching ? `Results · ${results.length}` : activeLabel}
            </p>
            <div ref={gridRef} className='scroll-thin flex-1 overflow-y-auto px-2 pb-2'>
                {results.length === 0 ? (
                    <p className='px-2 py-8 text-center text-sm text-slate-500'>No emoji found</p>
                ) : (
                    <div className='grid grid-cols-8 gap-0.5'>
                        {results.map(([emoji, keywords]) => (
                            <button key={emoji} type='button' onClick={() => onPick(emoji)}
                                aria-label={labelOf(keywords)} title={labelOf(keywords)}
                                className='grid aspect-square place-items-center rounded-lg text-2xl leading-none transition
                                hover:bg-slate-100 focus:outline-none focus-visible:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 active:scale-90'>
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmojiPicker;
