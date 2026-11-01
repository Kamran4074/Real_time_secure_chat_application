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
    // short "about" line shown on the profile
    bio:{
        type: String,
        maxlength: 140,
        default: ""
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
    },
    // set on password reset / change; tokens issued before it are rejected
    passwordChangedAt:{
        type: Date
    },
    // set by "log out from all devices"; tokens issued before it are rejected
    sessionsRevokedAt:{
        type: Date
    },
    // users this user has blocked (indexed: "who blocked me" is looked up too)
    blockedUsers:{
        type:[{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        default: [],
        index: true
    }
},{timestamps:true});

const User = mongoose.model("User",userSchema);

export default User;
