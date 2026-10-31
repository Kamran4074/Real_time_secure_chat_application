import mongoose from "mongoose";

// Tokens that were logged out before they expired
const revokedTokenSchema = mongoose.Schema({
    jti:{
        type:String,
        required:true,
        unique:true
    },
    expiresAt:{
        type:Date,
        required:true
    }
});

// MongoDB deletes the entry automatically once the token would have expired anyway
revokedTokenSchema.index({expiresAt:1},{expireAfterSeconds:0});

const RevokedToken = mongoose.model('RevokedToken',revokedTokenSchema);

export default RevokedToken;
