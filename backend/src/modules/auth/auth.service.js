import bcryptjs from "bcryptjs";
import { User, defaultAvatar, findByEmail, isUsernameTaken } from "../users/index.js";
import { createToken, revokeToken } from "./session.js";
import { AppError } from "../../shared/errors.js";
import logger from "../../shared/logger.js";
import { disconnectToken, disconnectUser } from "../../realtime/notifier.js";

export const hashPassword = (password)=> bcryptjs.hash(password, 10);

//----------------------
// register (input validated and trimmed by registerSchema)
//----------------------
export const register = async({fullname, username, email, gender, password})=>{
    // username / email already taken? (case-insensitive)
    if(await isUsernameTaken(username)){
        throw new AppError(400, 'AUTH_USERNAME_EXISTS', "Username already exists");
    }
    if(await findByEmail(email)){
        throw new AppError(400, 'AUTH_EMAIL_EXISTS', "Email already exists");
    }

    // profile pic is generated, never taken from the client
    const user = new User({
        fullname,
        username,
        email: email.toLowerCase(),
        gender,
        password: await hashPassword(password),
        profilepic: defaultAvatar(username)
    });
    try {
        await user.save();
    } catch (error) {
        // two sign-ups with the same username/email at the same moment
        if(error.code === 11000){
            throw new AppError(400, 'AUTH_ACCOUNT_EXISTS', "Username or email already exists");
        }
        throw error;
    }

    logger.info('User registered', {userId: user._id.toString()});
    return {user, token: createToken(user._id)};
};

//----------------------
// login
//----------------------
export const login = async({email, password})=>{
    const user = await findByEmail(email);
    // OAuth-only accounts have no password, so they can't log in this way
    const passwordOk = user?.password ? await bcryptjs.compare(password, user.password) : false;
    if(!passwordOk){
        // never log the email/password; the request log line has the IP
        logger.warn('Failed login attempt');
        // same message for both cases so attackers can't find out which emails exist
        throw new AppError(400, 'AUTH_INVALID_CREDENTIALS', "Invalid email or password");
    }

    logger.info('User logged in', {userId: user._id.toString()});
    return {user, token: createToken(user._id)};
};

//----------------------
// logout
//----------------------
// revoke this exact token so a stolen copy stops working too (other devices stay logged in)
export const logout = async(userId, claims)=>{
    await revokeToken(claims);
    await disconnectToken(userId, claims.jti);
    logger.info('User logged out', {userId: userId.toString()});
};

// every token issued before now is rejected (requireAuth / socket auth); live sockets are closed
export const logoutEverywhere = async(userId)=>{
    await User.updateOne({_id: userId}, {sessionsRevokedAt: new Date()});
    disconnectUser(userId);
    logger.info('User logged out from all devices', {userId: userId.toString()});
};
