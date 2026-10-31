import express from "express"
import authRouter from  './route/authUser.js'
import messageRouter from './route/messageRoute.js'
import userRouter from './route/userRout.js'
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import allowedOrigins from "./utils/allowedOrigins.js";
import logger, { errorMeta } from "./utils/logger.js";
import requestLogger from "./middleware/requestLogger.js";
import { HttpError, notFound, errorHandler } from "./middleware/errorHandler.js";

import {app , server} from './socket/socket.js'

// Render runs behind a proxy; needed so the rate limiter sees the real client IP
app.set('trust proxy', 1);

// first, so every request (even rejected ones) gets a request id and a log line
app.use(requestLogger);
app.use(helmet());
app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new HttpError(403, 'Origin not allowed'));
        }
    },
    credentials: true
}));
app.use(express.json({limit:'10kb'}));
app.use(cookieParser())

// Slow down password guessing: 20 login/register attempts per 15 min per IP
const authLimiter = rateLimit({
    windowMs: 15*60*1000,
    limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next, options)=>{
        logger.warn('Auth rate limit hit', {requestId: req.id, ip: req.ip, path: req.originalUrl.split('?')[0]});
        res.status(options.statusCode).send({success:false, message:"Too many attempts, please try again later"});
    }
});

app.use('/api/auth/login',authLimiter)
app.use('/api/auth/register',authLimiter)
app.use('/api/auth/oauth',authLimiter)
app.use('/api/auth',authRouter)
app.use('/api/message',messageRouter)
app.use('/api/user',userRouter)

app.get('/',(req,res)=>{
    res.send("Server is working");
})

// Health check for the scheduled ping: also touches MongoDB so the database counts as active
app.get('/api/health', async(req,res)=>{
    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).send({status:"ok", db:"up", uptime:Math.round(process.uptime())});
    } catch (error) {
        logger.warn('Health check: database unreachable', errorMeta(error));
        res.status(503).send({status:"error", db:"down"});
    }
})

// must be last
app.use(notFound);
app.use(errorHandler);

export {app , server}
