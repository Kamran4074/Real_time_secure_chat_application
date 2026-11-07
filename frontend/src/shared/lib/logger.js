// Error logging: full details while developing, just the message in production builds
const dev = import.meta.env.DEV;

const logger = {
    // in production keep just the message, not request/response objects that may hold user data
    error: (message, err) => {
        if (dev) console.error(message, err);
        else console.error(message, err?.response?.status ?? err?.message ?? '');
    },
};

export default logger;
