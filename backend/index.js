import express from "express";
import dotenv from "dotenv";
import dbConnect from "./DB/dbConnect.js";
import authRouter from './route/authUser.js'
import messageRouter from './route/messageRoute.js'

dotenv.config();

const app = express();

app.use(express.json());                // Must come BEFORE routes
app.use('/api/auth', authRouter);       // Now this can read JSON
app.use('/api/message', messageRouter); // This too


app.get('/',(req,res)=>{
    res.send("Server is working");
})

const PORT = process.env.PORT||3000;

app.listen(PORT,()=>{
    dbConnect(); 
    console.log(`Working at ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
})