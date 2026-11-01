import crypto from "crypto";
import bcryptjs from "bcryptjs";
import User from "../models/userModel.js";
import PasswordReset from "../models/passwordResetModel.js";
import escapeRegex from "../utils/escapeRegex.js";
import { clientUrl } from "../utils/allowedOrigins.js";
import { sendEmail, passwordResetEmail } from "../utils/email.js";
import { disconnectUser } from "../socket/socket.js";
import jwtToken from "../utils/jwt.js";
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

//----------------------
// change (or, for Google / GitHub accounts, set) the password while logged in
//----------------------
// body validated by changePasswordSchema
export const changePassword = async(req, res)=>{
    const {currentPassword, newPassword} = req.body;
    const user = await User.findById(req.user._id); // isLogin leaves the password out
    const hadPassword = Boolean(user.password);

    if(hadPassword && !(currentPassword && await bcryptjs.compare(currentPassword, user.password))){
        logger.warn('Change password: wrong current password', {requestId: req.id, userId: user._id.toString()});
        return res.status(400).send({success:false, message:"Current password is incorrect",
            errors:[{field:'currentPassword', message:"Current password is incorrect"}]});
    }

    user.password = await bcryptjs.hash(newPassword, 10);
    // every other session ends (isLogin / socket auth reject older tokens) ...
    user.passwordChangedAt = new Date();
    await user.save();
    await PasswordReset.deleteMany({userId: user._id}); // pending reset links stop working too
    disconnectUser(user._id);
    // ... and this device gets a fresh token so it stays logged in
    const token = jwtToken(user._id, res);
    logger.info(hadPassword ? 'Password changed' : 'Password set', {requestId: req.id, userId: user._id.toString()});
    res.status(200).send({success:true, message: hadPassword ? "Password changed" : "Password set", token});
};
