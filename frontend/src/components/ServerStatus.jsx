import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Spinner } from './ui/Button';

// Free Render servers sleep when idle and take ~30-60s to wake up.
// Ping the backend as soon as the site opens, so it starts waking while the
// user reads / types, and show a banner if it's slow so the app doesn't look broken.
const SLOW_AFTER_MS = 2500;      // show the banner only if the server is slow
const RETRY_EVERY_MS = 5000;
const GIVE_UP_AFTER_MS = 120000;
const EXPECTED_WAKE_S = 50;      // Render usually wakes in 30-60s; countdown starts here

const ServerStatus = () => {
    const [status, setStatus] = useState('checking'); // checking | waking | ready | done | down
    const [seconds, setSeconds] = useState(0);
    const [attempt, setAttempt] = useState(0);        // bump to retry manually
    const [dismissed, setDismissed] = useState(false); // user closed the banner; pinging continues
    const shownRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        let retryTimer;
        const started = Date.now();
        shownRef.current = false;
        setDismissed(false);
        setStatus('checking');
        setSeconds(0);

        const clock = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
        const slowTimer = setTimeout(() => {
            if (cancelled) return;
            shownRef.current = true;
            setStatus('waking');
        }, SLOW_AFTER_MS);

        const finish = (next) => {
            clearInterval(clock);
            clearTimeout(slowTimer);
            setStatus(next);
        };

        const ping = async () => {
            try {
                await axios.get('/api/health', { timeout: 60000 });
                if (cancelled) return;
                // fast server -> never show anything
                finish(shownRef.current ? 'ready' : 'done');
            } catch {
                if (cancelled) return;
                if (Date.now() - started > GIVE_UP_AFTER_MS) return finish('down');
                retryTimer = setTimeout(ping, RETRY_EVERY_MS);
            }
        };
        ping();

        return () => {
            cancelled = true;
            clearInterval(clock);
            clearTimeout(slowTimer);
            clearTimeout(retryTimer);
        };
    }, [attempt]);

    // hide the "ready" message after a moment
    useEffect(() => {
        if (status !== 'ready') return;
        const t = setTimeout(() => setStatus('done'), 2500);
        return () => clearTimeout(t);
    }, [status]);

    if (status === 'checking' || status === 'done' || dismissed) return null;

    const remaining = Math.max(EXPECTED_WAKE_S - seconds, 0);
    const progress = Math.min(seconds / EXPECTED_WAKE_S, 1) * 100;

    const styles = {
        waking: 'bg-yellow-100 border-yellow-400',
        ready: 'bg-green-100 border-green-500',
        down: 'bg-red-100 border-red-500',
    };

    return (
        <div role='status' aria-live='polite'
            className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md
            flex items-center gap-3 px-4 py-2 rounded-lg border shadow-lg text-sm text-gray-900 ${styles[status]}`}>
            {status === 'waking' && (
                <>
                    <Spinner className='shrink-0 border-amber-300 border-t-amber-700' />
                    <span className='flex-1'>
                        {remaining > 0 ? (
                            <b>Server is starting… ready in ~{remaining}s</b>
                        ) : (
                            <b>Almost there… taking a little longer than usual</b>
                        )}
                        <span className='block text-xs text-gray-700'>
                            Free hosting sleeps when idle, so the first visit takes up to a minute.
                        </span>
                        <span className='block mt-2 h-1.5 w-full rounded-full bg-yellow-200 overflow-hidden'>
                            <span className='block h-full bg-yellow-500 transition-all duration-1000 ease-linear'
                                style={{ width: `${progress}%` }}></span>
                        </span>
                    </span>
                    <button onClick={() => setDismissed(true)} aria-label='Hide message'
                        className='self-start shrink-0 w-6 h-6 rounded-full text-gray-700 hover:bg-yellow-200'>
                        ✕
                    </button>
                </>
            )}
            {status === 'ready' && <span><b>Server is ready ✓</b></span>}
            {status === 'down' && (
                <>
                    <span className='flex-1'><b>Server is not responding.</b> Please try again in a bit.</span>
                    <button onClick={() => setAttempt(a => a + 1)}
                        className='px-3 py-1 rounded-md bg-gray-900 text-white text-xs shrink-0'>
                        Retry
                    </button>
                </>
            )}
        </div>
    );
};

export default ServerStatus;
