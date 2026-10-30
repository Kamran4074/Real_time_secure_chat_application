import express from "express"
import dotenv from 'dotenv'
import dbConnect from "./DB/dbConnect.js";
import authRouter from  './route/authUser.js'
import messageRouter from './route/messageRoute.js'
import userRouter from './route/userRout.js'
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import {app , server} from './socket/socket.js'

dotenv.config();

if(!process.env.JWT_SECRET || !process.env.MONGODB_CONNECT){
    console.error("JWT_SECRET and MONGODB_CONNECT must be set");
    process.exit(1);
}

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
    limit: 20,
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

const PORT = process.env.PORT || 3000

// Connect to the database before accepting requests
await dbConnect();
server.listen(PORT,()=>{
    console.log(`Working at ${PORT}`);
})
