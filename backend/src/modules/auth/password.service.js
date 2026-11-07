import bcryptjs from "bcryptjs";
import { User, findByEmail } from "../users/index.js";
import PasswordReset from "./models/passwordReset.model.js";
import { hashPassword } from "./auth.service.js";
import { AppError, fieldError } from "../../shared/errors.js";
import { sha256, randomToken } from "../../shared/crypto.js";
import { sendEmail, passwordResetEmail } from "../../shared/services/email.js";
import logger, { errorMeta } from "../../shared/logger.js";
import { clientUrl } from "../../config/urls.js";
import { disconnectUser } from "../../realtime/notifier.js";

const TOKEN_TTL_MINUTES = 30;

// the new password is set: every older token stops working (requireAuth / socket auth),
// pending reset links are dropped and live sockets are closed
const setPassword = async(user, password)=>{
    user.password = await hashPassword(password);
    user.passwordChangedAt = new Date();
    await user.save();
    await PasswordReset.deleteMany({userId: user._id});
    disconnectUser(user._id);
};

//----------------------
// step 1: email a reset link. Same outcome whether or not the email exists,
// so this can't be used to find accounts.
//----------------------
export const requestReset = async(email)=>{
    const user = await findByEmail(email);
    if(!user){
        logger.info('Password reset requested for unknown email');
        return;
    }

    // only the newest link works
    await PasswordReset.deleteMany({userId: user._id});
    const token = randomToken(32);
    await PasswordReset.create({
        tokenHash: sha256(token),
        userId: user._id,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES*60*1000)
    });

    const link = `${clientUrl()}/reset-password?token=${token}`;
    try {
        await sendEmail({to: user.email, ...passwordResetEmail({name: user.fullname, link, minutes: TOKEN_TTL_MINUTES})});
        logger.info('Password reset email sent', {userId: user._id.toString()});
    } catch (error) {
        // the caller still answers the same way; the failure is in the logs (with the request id)
        logger.error('Password reset email failed', {userId: user._id.toString(), ...errorMeta(error)});
    }
};

//----------------------
// step 2: set the new password with the emailed token
//----------------------
export const resetPassword = async(token, password)=>{
    // findOneAndDelete makes the link single-use
    const entry = await PasswordReset.findOneAndDelete({tokenHash: sha256(token), expiresAt: {$gt: new Date()}});
    const user = entry && await User.findById(entry.userId);
    if(!user){
        throw new AppError(400, 'AUTH_RESET_LINK_INVALID', "This reset link is invalid or has expired");
    }
    await setPassword(user, password);
    logger.info('Password reset', {userId: user._id.toString()});
};

//----------------------
// change (or, for Google / GitHub accounts, set) the password while logged in.
// Every session ends; the caller starts a fresh one for this device. Returns whether a password existed before.
//----------------------
export const changePassword = async(userId, {currentPassword, newPassword})=>{
    const user = await User.findById(userId);
    const hadPassword = Boolean(user.password);

    if(hadPassword && !(currentPassword && await bcryptjs.compare(currentPassword, user.password))){
        logger.warn('Change password: wrong current password', {userId: user._id.toString()});
        throw fieldError(400, 'AUTH_WRONG_PASSWORD', 'currentPassword', "Current password is incorrect");
    }

    await setPassword(user, newPassword);
    logger.info(hadPassword ? 'Password changed' : 'Password set', {userId: user._id.toString()});
    return hadPassword;
};
