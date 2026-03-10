import User from "../Models/userModels.js";
import bcryptjs from "bcryptjs";
import jwtToken from "../utils/jwtwebTokens.js";


//----------------------
//registration loggic
//----------------------
export const userRegister = async(req, res)=>{
    try {
        const{fullname,username,email,gender,password,profilepic} = req.body;
        
        // Validate required fields
        if(!fullname || !username || !email || !gender || !password){
            return res.status(400).send({success:false, message:"All fields are required"});
        }
        
        //check weather there is user present or not (case-insensitive)
        const user = await User.findOne({
            $or: [
                {username: {$regex: new RegExp(`^${username}$`, 'i')}}, 
                {email: {$regex: new RegExp(`^${email}$`, 'i')}}
            ]
        });

        // if user present
        if(user) {
            if(user.username.toLowerCase() === username.toLowerCase()){
                return res.status(400).send({success:false, message:"Username already exists"});
            }
            if(user.email.toLowerCase() === email.toLowerCase()){
                return res.status(400).send({success:false, message:"Email already exists"});
            }
        }

        //hash password
        const hashPassword = bcryptjs.hashSync(password,10);

        //profile pic
        const profileBoy = profilepic || `https://avatar.iran.liara.run/public?username=${username}`;
        const profileGirl = profilepic || `https://avatar.iran.liara.run/public?username=${username}`;

        //saving user in database
        const newUser = new User({
            fullname,
            username,
            email,
            gender,
            password:hashPassword,
            profilepic: gender === "male" ? profileBoy : profileGirl
        });

        //saving user
        if(newUser){
            await newUser.save(); //saved
            //after saving using jwt token from utils
            jwtToken(newUser._id,res);

        }else{
            res.status(400).send({success:false,message:"Problem in saving data in data base"})
        }

        //sending to frontend
        res.status(201).send({
            _id:newUser._id,
            fullname:newUser.fullname,
            username:newUser.username,
            profilepic:newUser.profilepic,
            email:newUser.email
        })

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({
            success:false,
            message: error.message || 'Internal server error',
        })
    }
}

//---------------------
//login loggic
//---------------------
export const userLogin = async(req,res)=>{ 
    try {
        const{email,password} = req.body;
        const user = await User.findOne({email: {$regex: new RegExp(`^${email}$`, 'i')}});
        if(!user) return res.status(400).send({success:false,message:"Email doesn't exist"});
        const comparePass = bcryptjs.compareSync(password,user.password || "");
        if(!comparePass) return res.status(400).send({success:false,message:"Email/password does not match"});

        //jwt token is is added while login
        jwtToken(user._id,res); 
       //if password matches
       res.status(200).send({
            _id:user._id,
            fullname:user.fullname,
            username:user.username,
            profilepic:user.profilepic,
            email:user.email,
            message:"succesfully login"
       })

        
    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({
            success:false,
            message: error.message || 'Internal server error',
        })
    }
}

//-------------------
//logout loggic
//-------------------

export const userLogout = async(req,res)=>{

    try {
        res.cookie("jwt",'',{maxAge:0}); 
        // delete cookie will delete token and user will get logout
        res.status(200).send({message:"User logout"});

    } catch (error) {
        console.log('Error details:', error);
        res.status(500).send({
            success:false,
            message: error.message || 'Internal server error',
        })
    }
}