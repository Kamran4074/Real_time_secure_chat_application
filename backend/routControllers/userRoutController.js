import User from "../Models/userModels.js";
import bcryptjs from "bcryptjs";
import jwtToken, { cookieOptions, revokeToken } from "../utils/jwtwebTokens.js";
import { disconnectToken } from "../socket/socket.js";
import escapeRegex from "../utils/escapeRegex.js";

const isNonEmptyString = (v)=> typeof v === 'string' && v.trim().length > 0;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,20}$/;

//----------------------
//registration loggic
//----------------------
export const userRegister = async(req, res)=>{
    try {
        const{fullname,username,email,gender,password} = req.body;

        // Validate required fields
        if(![fullname,username,email,gender,password].every(isNonEmptyString)){
            return res.status(400).send({success:false, message:"All fields are required"});
        }
        if(!EMAIL_REGEX.test(email)){
            return res.status(400).send({success:false, message:"Invalid email"});
        }
        if(!USERNAME_REGEX.test(username)){
            return res.status(400).send({success:false, message:"Username must be 3-20 characters (letters, numbers, _ or .)"});
        }
        if(password.length < 6 || password.length > 72){
            return res.status(400).send({success:false, message:"Password must be 6-72 characters"});
        }

        //check weather there is user present or not (case-insensitive)
        const user = await User.findOne({
            $or: [
                {username: {$regex: `^${escapeRegex(username)}$`, $options: 'i'}},
                {email: {$regex: `^${escapeRegex(email)}$`, $options: 'i'}}
            ]
        });

        // if user present
        if(user) {
            if(user.username.toLowerCase() === username.toLowerCase()){
                return res.status(400).send({success:false, message:"Username already exists"});
            }
            return res.status(400).send({success:false, message:"Email already exists"});
        }

        //hash password
        const hashPassword = await bcryptjs.hash(password,10);

        //saving user in database (profile pic is generated, never taken from the client)
        const newUser = new User({
            fullname: fullname.trim(),
            username,
            email: email.toLowerCase(),
            gender,
            password:hashPassword,
            profilepic: `https://avatar.iran.liara.run/public?username=${encodeURIComponent(username)}`
        });

        await newUser.save();
        const token = jwtToken(newUser._id,res);
        res.status(201).send({
            _id:newUser._id,
            fullname:newUser.fullname,
            username:newUser.username,
            profilepic:newUser.profilepic,
            email:newUser.email,
            token,
            message:"Registered successfully"
        })

    } catch (error) {
        console.log('Error details:', error);
        if(error.name === 'ValidationError'){
            return res.status(400).send({success:false, message:"Invalid registration data"});
        }
        res.status(500).send({success:false, message:'Internal server error'})
    }
}

//---------------------
//login loggic
//---------------------
export const userLogin = async(req,res)=>{
    try {
        const{email,password} = req.body;
        if(!isNonEmptyString(email) || !isNonEmptyString(password)){
            return res.status(400).send({success:false,message:"Email and password are required"});
        }

        const user = await User.findOne({email: {$regex: `^${escapeRegex(email)}$`, $options: 'i'}});
        // Same message for both cases so attackers can't find out which emails exist
        const comparePass = user ? await bcryptjs.compare(password,user.password || "") : false;
        if(!comparePass) return res.status(400).send({success:false,message:"Invalid email or password"});

        const token = jwtToken(user._id,res);
        res.status(200).send({
            _id:user._id,
            fullname:user.fullname,
            username:user.username,
            profilepic:user.profilepic,
            email:user.email,
            token,
            message:"succesfully login"
        })

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({success:false, message:'Internal server error'})
    }
}

//-------------------
//logout loggic
//-------------------

export const userLogout = async(req,res)=>{

    try {
        // revoke this exact token so a stolen copy stops working too (other devices stay logged in)
        await revokeToken(req.token);
        await disconnectToken(req.user._id, req.token.jti);
        // must use the same options the cookie was set with, otherwise the browser keeps it
        res.clearCookie("jwt", cookieOptions);
        res.status(200).send({message:"User logout"});

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({success:false, message:'Internal server error'})
    }
}
