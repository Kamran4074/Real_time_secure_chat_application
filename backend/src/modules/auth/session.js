import jwt from "jsonwebtoken";
import crypto from "crypto";
import RevokedToken from "./models/revokedToken.model.js";
import { User } from "../users/index.js";

// Sessions are JWTs (7 days). Each has a jti so one exact token can be revoked on logout.
const TOKEN_LIFETIME = '7d';

export const createToken = (userId)=> jwt.sign(
    {userId},
    process.env.JWT_SECRET,
    {expiresIn: TOKEN_LIFETIME, jwtid: crypto.randomUUID()}
);

const tokenError = (message)=> Object.assign(new Error(message), {name: 'AuthTokenError'});

// Errors that mean "this token is not valid" (anything else, e.g. a database error, is a server problem)
export const isTokenError = (err)=>
    ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError', 'AuthTokenError'].includes(err?.name);

// Verifies signature + expiry and rejects tokens that were logged out. Throws if invalid.
export const verifyToken = async(token)=>{
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    if(!claims.jti) throw tokenError("Token has no id"); // tokens issued before revocation existed
    if(await RevokedToken.exists({jti: claims.jti})) throw tokenError("Token revoked");
    return claims;
};

// Fields isSessionRevoked() needs, for queries that select only a few fields
const SESSION_FIELDS = 'passwordChangedAt sessionsRevokedAt';

// true when the password changed or "log out everywhere" happened after this token was issued (iat is in seconds)
export const isSessionRevoked = (claims, user)=>
    [user?.passwordChangedAt, user?.sessionsRevokedAt]
        .some(date => date && claims.iat < Math.floor(date.getTime()/1000));

export const revokeToken = async(claims)=>{
    await RevokedToken.updateOne(
        {jti: claims.jti},
        {jti: claims.jti, expiresAt: new Date(claims.exp*1000)},
        {upsert: true}
    );
};

// For Socket.IO: {userId, jti} of a valid, live session, or null
export const authenticateSocketToken = async(token)=>{
    if(!token) return null;
    try {
        const claims = await verifyToken(token);
        const user = await User.findById(claims.userId).select(SESSION_FIELDS);
        if(!user || isSessionRevoked(claims, user)) return null;
        return {userId: claims.userId.toString(), jti: claims.jti};
    } catch (error) {
        if(isTokenError(error)) return null;
        throw error;
    }
};
