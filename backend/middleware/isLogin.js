import User from "../Models/userModels.js";
import { verifyToken } from "../utils/jwtwebTokens.js";

const isLogin = async(req, res, next) => {
    try {
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
            // expired / tampered / logged-out token
            return res.status(401).send({success:false, message:"Session expired, please login again"});
        }

        const user = await User.findById(decode.userId).select("-password");

        if(!user) {
            return res.status(401).send({success:false, message:"User not found"});
        }

        req.user = user; // Attach user to request
        req.token = decode;
        next(); // Continue to next middleware/controller

    } catch (error) {
        console.log('error in isLogin middleware:', error);
        res.status(500).send({success:false, message:"Internal server error"});
    }
}

export default isLogin;
