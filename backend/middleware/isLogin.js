import User from "../models/userModel.js";
import { verifyToken, isTokenError, issuedBeforePasswordChange } from "../utils/jwt.js";

const isLogin = async(req, res, next) => {
    // Accept token from cookie OR Authorization header
    let token = req.cookies.jwt;
    if(!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if(!token) {
        return res.status(401).send({success:false, message:"User unauthorized"});
    }

    let decode;
    try {
        decode = await verifyToken(token);
    } catch (err) {
        // expired / tampered / logged-out token -> 401; anything else (e.g. database down) -> error handler
        if(!isTokenError(err)) throw err;
        return res.status(401).send({success:false, message:"Session expired, please login again"});
    }

    const user = await User.findById(decode.userId).select("-password");

    if(!user) {
        return res.status(401).send({success:false, message:"User not found"});
    }
    if(issuedBeforePasswordChange(decode, user)) {
        return res.status(401).send({success:false, message:"Session expired, please login again"});
    }

    req.user = user;
    req.token = decode;
    next();
}

export default isLogin;
