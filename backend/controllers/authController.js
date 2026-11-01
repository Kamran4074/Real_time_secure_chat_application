import User from "../models/userModel.js";
import bcryptjs from "bcryptjs";
import jwtToken, { cookieOptions, revokeToken } from "../utils/jwt.js";
import { disconnectToken, disconnectUser } from "../socket/socket.js";
import escapeRegex from "../utils/escapeRegex.js";
import { defaultAvatar } from "../utils/avatar.js";
import logger from "../utils/logger.js";

// Input is validated and trimmed by registerSchema / loginSchema before these run (see routes/authRoutes.js).
// Unexpected errors go to the central error handler.

const loginResponse = (user, token, message)=> ({
    _id:user._id,
    fullname:user.fullname,
    username:user.username,
    profilepic:user.profilepic,
    email:user.email,
    token,
    message
});

//----------------------
// register
//----------------------
export const userRegister = async(req, res)=>{
    const{fullname,username,email,gender,password} = req.body;

    // username / email already taken? (case-insensitive)
    const user = await User.findOne({
        $or: [
            {username: {$regex: `^${escapeRegex(username)}$`, $options: 'i'}},
            {email: {$regex: `^${escapeRegex(email)}$`, $options: 'i'}}
        ]
    });

    if(user) {
        if(user.username.toLowerCase() === username.toLowerCase()){
            return res.status(400).send({success:false, message:"Username already exists"});
        }
        return res.status(400).send({success:false, message:"Email already exists"});
    }

    const hashPassword = await bcryptjs.hash(password,10);

    // profile pic is generated, never taken from the client
    const newUser = new User({
        fullname,
        username,
        email: email.toLowerCase(),
        gender,
        password:hashPassword,
        profilepic: defaultAvatar(username)
    });

    try {
        await newUser.save();
    } catch (error) {
        // two sign-ups with the same username/email at the same moment
        if(error.code === 11000){
            return res.status(400).send({success:false, message:"Username or email already exists"});
        }
        throw error;
    }

    logger.info('User registered', {requestId:req.id, userId:newUser._id.toString()});
    const token = jwtToken(newUser._id,res);
    res.status(201).send(loginResponse(newUser, token, "Registered successfully"));
}

//---------------------
// login
//---------------------
export const userLogin = async(req,res)=>{
    const{email,password} = req.body;

    const user = await User.findOne({email: {$regex: `^${escapeRegex(email)}$`, $options: 'i'}});
    // OAuth-only accounts have no password, so they can't log in this way
    const comparePass = user?.password ? await bcryptjs.compare(password,user.password) : false;
    if(!comparePass){
        // never log the email/password, only that it happened and from where
        logger.warn('Failed login attempt', {requestId:req.id, ip:req.ip});
        // Same message for both cases so attackers can't find out which emails exist
        return res.status(400).send({success:false,message:"Invalid email or password"});
    }

    logger.info('User logged in', {requestId:req.id, userId:user._id.toString()});
    const token = jwtToken(user._id,res);
    res.status(200).send(loginResponse(user, token, "Logged in successfully"));
}

//-------------------
// logout
//-------------------

export const userLogout = async(req,res)=>{
    // revoke this exact token so a stolen copy stops working too (other devices stay logged in)
    await revokeToken(req.token);
    await disconnectToken(req.user._id, req.token.jti);
    // must use the same options the cookie was set with, otherwise the browser keeps it
    res.clearCookie("jwt", cookieOptions);
    logger.info('User logged out', {requestId:req.id, userId:req.user._id.toString()});
    res.status(200).send({message:"User logout"});
}

//-------------------
// log out from all devices (including this one)
//-------------------
export const userLogoutAll = async(req,res)=>{
    // every token issued before now is rejected by isLogin / socket auth
    await User.updateOne({_id:req.user._id}, {sessionsRevokedAt:new Date()});
    disconnectUser(req.user._id);
    res.clearCookie("jwt", cookieOptions);
    logger.info('User logged out from all devices', {requestId:req.id, userId:req.user._id.toString()});
    res.status(200).send({message:"Logged out from all devices"});
}
