import jwt from "jsonwebtoken";
import crypto from "crypto";
import RevokedToken from "../models/revokedTokenModel.js";

// Same options must be used when clearing the cookie, or the browser ignores it
export const cookieOptions = {
    httpOnly:true,
    sameSite:"none",
    secure:true
}

const jwtToken = (userId , res)=>{
    const token = jwt.sign(
        {userId},
        process.env.JWT_SECRET,
        {expiresIn:'7d', jwtid:crypto.randomUUID()} // jti lets us revoke this exact token on logout
    )
    res.cookie('jwt',token,{
        ...cookieOptions,
        maxAge: 7*24*60*60*1000
    })
    return token;
}

const tokenError = (message)=> Object.assign(new Error(message), {name:'AuthTokenError'});

// Errors that mean "this token is not valid" (anything else, e.g. a database error, is a server problem)
export const isTokenError = (err)=>
    ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError', 'AuthTokenError'].includes(err?.name);

// Verifies signature + expiry and rejects tokens that were logged out. Throws if invalid.
export const verifyToken = async(token)=>{
    const decode = jwt.verify(token, process.env.JWT_SECRET);
    if(!decode.jti) throw tokenError("Token has no id"); // tokens issued before revocation existed
    if(await RevokedToken.exists({jti:decode.jti})) throw tokenError("Token revoked");
    return decode;
}

export const revokeToken = async(decode)=>{
    await RevokedToken.updateOne(
        {jti:decode.jti},
        {jti:decode.jti, expiresAt:new Date(decode.exp*1000)},
        {upsert:true}
    );
}

export default jwtToken;
