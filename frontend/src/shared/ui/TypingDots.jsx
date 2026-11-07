const TypingDots = ({ color = 'bg-slate-400' }) => (
    <span className='inline-flex items-center gap-1' aria-label='typing'>
        {[0, 150, 300].map(delay => (
            <span key={delay} className={`w-1.5 h-1.5 rounded-full animate-bounce ${color}`}
                style={{ animationDelay: `${delay}ms` }} />
        ))}
    </span>
);

export default TypingDots;
