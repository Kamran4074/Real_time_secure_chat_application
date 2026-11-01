// "● Online" in green, or a plain grey "Offline"
const OnlineStatus = ({ online, className = '' }) => (
    online ? (
        <span className={`inline-flex items-center gap-1.5 font-medium text-emerald-600 ${className}`}>
            <span aria-hidden className='h-2 w-2 rounded-full bg-emerald-500' />
            Online
        </span>
    ) : (
        <span className={`text-slate-500 ${className}`}>Offline</span>
    )
);

export default OnlineStatus;
