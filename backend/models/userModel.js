import mongoose from "mongoose";

// OAuth-only accounts (Google / GitHub) have no password or gender
function isLocalAccount(){
    return !this.googleId && !this.githubId;
}

const userSchema = mongoose.Schema({
    fullname:{
        type: String,
        required: true
    },
    username:{
        type: String,
        required: true,
        unique: true
    },
    email:{
       type: String,
        required: true,
        unique: true
    },
    gender:{
        type: String,
        required: isLocalAccount,
        enum:["male","female","other"]
    },
    password:{
        type: String,
        required: isLocalAccount,
        minlength:6

    },
    profilepic:{
        type: String,
        required: true,
        default:""
    },
    // OAuth provider account ids (sparse: only some users have them)
    googleId:{
        type: String,
        unique: true,
        sparse: true
    },
    githubId:{
        type: String,
        unique: true,
        sparse: true
    }
},{timestamps:true});

const User = mongoose.model("User",userSchema);

export default User;
