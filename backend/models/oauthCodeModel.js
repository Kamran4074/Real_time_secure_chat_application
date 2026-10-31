import mongoose from "mongoose";

// One-time code handed to the frontend after an OAuth login.
// The frontend swaps it for a JWT, so the JWT never appears in a URL.
const oauthCodeSchema = mongoose.Schema({
    codeHash:{
        type:String,
        required:true,
        unique:true
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    expiresAt:{
        type:Date,
        required:true
    }
});

// MongoDB removes expired codes automatically
oauthCodeSchema.index({expiresAt:1},{expireAfterSeconds:0});

const OAuthCode = mongoose.model('OAuthCode',oauthCodeSchema);

export default OAuthCode;
