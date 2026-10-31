export const Spinner = ({ className = 'border-white/40 border-t-white' }) => (
    <span aria-hidden className={`inline-block w-4 h-4 rounded-full border-2 animate-spin ${className}`} />
);

// Primary full-width button with a loading state
const Button = ({ loading = false, children, className = '', ...props }) => (
    <button
        {...props}
        disabled={loading || props.disabled}
        className={`w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600
            text-[15px] font-semibold text-white shadow-sm shadow-brand-600/30 transition
            hover:bg-brand-700 active:scale-[.99]
            focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30
            disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
        {loading && <Spinner />}
        {children}
    </button>
);

export default Button;
