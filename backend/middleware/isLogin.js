import jwt from "jsonwebtoken";
import User from "../Models/userModels.js";

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
        
        const decode = jwt.verify(token, process.env.JWT_SECRET); 
        
        if(!decode) {
            return res.status(401).send({success:false, message:"Invalid token"});
        }
        
        const user = await User.findById(decode.userId).select("-password");
        
        if(!user) {
            return res.status(404).send({success:false, message:"User not found"});
        }
        
        req.user = user; // Attach user to request
        next(); // Continue to next middleware/controller
        
    } catch (error) {
        console.log('error in isLogin middleware:', error);
        res.status(500).send({success:false, message: error.message});
    }
}

export default isLogin;
