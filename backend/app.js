import express from "express"
import authRouter from  './route/authUser.js'
import messageRouter from './route/messageRoute.js'
import userRouter from './route/userRout.js'
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import {app , server} from './socket/socket.js'

// Render runs behind a proxy; needed so the rate limiter sees the real client IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = ['http://localhost:5173', 'https://chatwave-azure.vercel.app'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
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
    message: {success:false, message:"Too many attempts, please try again later"}
});

app.use('/api/auth/login',authLimiter)
app.use('/api/auth/register',authLimiter)
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
        res.status(503).send({status:"error", db:"down"});
    }
})

export {app , server}
