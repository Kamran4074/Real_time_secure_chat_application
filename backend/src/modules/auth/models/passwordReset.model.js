import mongoose from "mongoose";

// One-time password reset token. Only its hash is stored, so a database leak can't be used to reset passwords.
const passwordResetSchema = mongoose.Schema({
    tokenHash:{
        type:String,
        required:true,
        unique:true
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
        index:true
    },
    expiresAt:{
        type:Date,
        required:true
    }
});

// MongoDB removes expired tokens automatically
passwordResetSchema.index({expiresAt:1},{expireAfterSeconds:0});

const PasswordReset = mongoose.model('PasswordReset',passwordResetSchema);

export default PasswordReset;
