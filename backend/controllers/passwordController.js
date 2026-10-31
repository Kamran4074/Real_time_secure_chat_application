import crypto from "crypto";
import bcryptjs from "bcryptjs";
import User from "../models/userModel.js";
import PasswordReset from "../models/passwordResetModel.js";
import escapeRegex from "../utils/escapeRegex.js";
import { clientUrl } from "../utils/allowedOrigins.js";
import { sendEmail, passwordResetEmail } from "../utils/email.js";
import { disconnectUser } from "../socket/socket.js";
import logger, { errorMeta } from "../utils/logger.js";

const TOKEN_TTL_MINUTES = 30;
const sha256 = (value)=> crypto.createHash('sha256').update(value).digest('hex');

// Same answer whether or not the email exists, so this can't be used to find accounts
const SENT_MESSAGE = "If an account exists for that email, a reset link is on its way";

//----------------------
// step 1: email a reset link (body validated by forgotPasswordSchema)
//----------------------
export const forgotPassword = async(req, res)=>{
    const {email} = req.body;
    const user = await User.findOne({email: {$regex: `^${escapeRegex(email)}$`, $options: 'i'}});

    if(!user){
        logger.info('Password reset requested for unknown email', {requestId: req.id});
        return res.status(200).send({success:true, message:SENT_MESSAGE});
    }

    // only the newest link works
    await PasswordReset.deleteMany({userId: user._id});
    const token = crypto.randomBytes(32).toString('hex');
    await PasswordReset.create({
        tokenHash: sha256(token),
        userId: user._id,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES*60*1000)
    });

    const link = `${clientUrl()}/reset-password?token=${token}`;
    try {
        await sendEmail({to: user.email, ...passwordResetEmail({name: user.fullname, link, minutes: TOKEN_TTL_MINUTES})});
        logger.info('Password reset email sent', {requestId: req.id, userId: user._id.toString()});
    } catch (error) {
        // still answer the same way; the failure is in the logs (with the request id)
        logger.error('Password reset email failed', {requestId: req.id, userId: user._id.toString(), ...errorMeta(error)});
    }
    res.status(200).send({success:true, message:SENT_MESSAGE});
};

//----------------------
// step 2: set the new password (body validated by resetPasswordSchema)
//----------------------
export const resetPassword = async(req, res)=>{
    const {token, password} = req.body;

    // findOneAndDelete makes the link single-use
    const entry = await PasswordReset.findOneAndDelete({tokenHash: sha256(token), expiresAt: {$gt: new Date()}});
    const user = entry && await User.findById(entry.userId);
    if(!user){
        return res.status(400).send({success:false, message:"This reset link is invalid or has expired"});
    }

    user.password = await bcryptjs.hash(password, 10);
    // every token issued before this moment stops working (see isLogin / socket auth)
    user.passwordChangedAt = new Date();
    await user.save();
    await PasswordReset.deleteMany({userId: user._id});
    await disconnectUser(user._id);

    logger.info('Password reset', {requestId: req.id, userId: user._id.toString()});
    res.status(200).send({success:true, message:"Password updated, please log in"});
};
