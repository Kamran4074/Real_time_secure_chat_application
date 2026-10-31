import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

// All limits can be changed with env variables (tests set them high, rateLimit.test.js sets them low)
const limitFrom = (name, fallback)=> Number(process.env[name]) || fallback;

const createLimiter = ({name, windowMs, limit, message, keyGenerator})=> rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-7', // RateLimit + Retry-After headers
    legacyHeaders: false,
    handler: (req, res, next, options)=>{
        logger.warn(`${name} rate limit hit`, {requestId: req.id, ip: req.ip, userId: req.user?._id?.toString(), path: req.originalUrl.split('?')[0]});
        res.status(options.statusCode).send({success:false, message});
    }
});

// Slow down password guessing: 20 login/register attempts per 15 min per IP
export const authLimiter = createLimiter({
    name: 'Auth',
    windowMs: 15*60*1000,
    limit: limitFrom('AUTH_RATE_LIMIT', 20),
    message: "Too many attempts, please try again later"
});

// Overall cap for every API route per IP (the keep-alive health check is not counted)
export const apiLimiter = (()=>{
    const limiter = createLimiter({
        name: 'API',
        windowMs: 15*60*1000,
        limit: limitFrom('API_RATE_LIMIT', 600),
        message: "Too many requests, please slow down"
    });
    return (req, res, next)=> req.path === '/health' ? next() : limiter(req, res, next);
})();

// Spam protection for sending messages: 30 per minute per logged-in user (runs after isLogin)
export const messageLimiter = createLimiter({
    name: 'Message',
    windowMs: 60*1000,
    limit: limitFrom('MESSAGE_RATE_LIMIT', 30),
    keyGenerator: (req)=> req.user._id.toString(),
    message: "You're sending messages too fast, please wait a moment"
});

// User search hits the database with a regex: 60 per minute per logged-in user
export const searchLimiter = createLimiter({
    name: 'Search',
    windowMs: 60*1000,
    limit: limitFrom('SEARCH_RATE_LIMIT', 60),
    keyGenerator: (req)=> req.user._id.toString(),
    message: "Too many searches, please wait a moment"
});

// Socket.IO events have no HTTP middleware: allow `limit` events per `windowMs` per socket, drop the rest
export const socketEventLimiter = ({limit = 20, windowMs = 5000} = {})=>{
    let count = 0;
    let windowStart = Date.now();
    return ()=>{
        const now = Date.now();
        if(now - windowStart >= windowMs){
            windowStart = now;
            count = 0;
        }
        count++;
        return count <= limit;
    };
};
