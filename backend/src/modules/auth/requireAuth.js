import { User } from "../users/index.js";
import { verifyToken, isTokenError, isSessionRevoked } from "./session.js";
import { SESSION_COOKIE } from "./sessionCookie.js";

// Route guard: sets req.user (without password) and req.token (the verified claims), or answers 401
const requireAuth = async(req, res, next)=>{
    // token from the cookie OR the Authorization header (cross-site cookies are blocked by some browsers)
    let token = req.cookies[SESSION_COOKIE];
    if(!token && req.headers.authorization?.startsWith('Bearer ')){
        token = req.headers.authorization.split(' ')[1];
    }
    if(!token){
        return res.status(401).send({success:false, message:"User unauthorized"});
    }

    let claims;
    try {
        claims = await verifyToken(token);
    } catch (err) {
        // expired / tampered / logged-out token -> 401; anything else (e.g. database down) -> error handler
        if(!isTokenError(err)) throw err;
        return res.status(401).send({success:false, message:"Session expired, please login again"});
    }

    const user = await User.findById(claims.userId).select("-password");
    if(!user){
        return res.status(401).send({success:false, message:"User not found"});
    }
    if(isSessionRevoked(claims, user)){
        return res.status(401).send({success:false, message:"Session expired, please login again"});
    }

    req.user = user;
    req.token = claims;
    next();
};

export default requireAuth;
