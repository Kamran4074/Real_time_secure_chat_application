// Small console wrapper: full logs while developing, only errors in production builds
const dev = import.meta.env.DEV;

const logger = {
    debug: (...args) => { if (dev) console.debug(...args); },
    info: (...args) => { if (dev) console.info(...args); },
    warn: (...args) => { if (dev) console.warn(...args); },
    // in production keep just the message, not request/response objects that may hold user data
    error: (message, err) => {
        if (dev) console.error(message, err);
        else console.error(message, err?.response?.status ?? err?.message ?? '');
    },
};

export default logger;
