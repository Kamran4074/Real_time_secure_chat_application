import crypto from 'crypto';
import logger from '../utils/logger.js';

// Logs one line per request: method, path, status, duration, request id.
// Query strings are never logged (they can carry OAuth codes / state).
const requestLogger = (req, res, next)=>{
    const start = process.hrtime.bigint();
    const incoming = req.get('x-request-id');
    req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);

    res.on('finish', ()=>{
        const path = req.originalUrl.split('?')[0];
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        const status = res.statusCode;
        // keep-alive pings hit /api/health every 14 min; don't let them flood the logs
        const level = status >= 500 ? 'error'
            : status >= 400 ? 'warn'
            : path === '/api/health' ? 'debug'
            : 'info';

        logger.log(level, `${req.method} ${path} ${status} ${ms.toFixed(1)}ms`, {
            requestId: req.id,
            ...(req.user && { userId: req.user._id.toString() }),
            ip: req.ip
        });
    });

    next();
};

export default requestLogger;
