import express from "express"
import dotenv from 'dotenv'
import dbConnect from "./DB/dbConnect.js";
import authRouter from  './route/authUser.js'
import messageRouter from './route/messageRoute.js'
import userRouter from './route/userRout.js'
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import {app , server} from './socket/socket.js'

const __dirname = path.resolve();

dotenv.config();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())

app.use('/api/auth',authRouter)
app.use('/api/message',messageRouter)
app.use('/api/user',userRouter)

app.get('/',(req,res)=>{
    res.send("Server is working");
})

const PORT = process.env.PORT || 3000

server.listen(PORT,()=>{
    dbConnect();
    console.log(`Working at ${PORT}`);
})