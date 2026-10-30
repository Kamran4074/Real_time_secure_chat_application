import express from "express";
import { userLogin, userLogout, userRegister } from "../routControllers/userRoutController.js";
import isLogin from "../middleware/isLogin.js";

const router = express.Router();

router.post('/register',userRegister);
router.post('/login',userLogin);
router.post('/logout',isLogin,userLogout);

export default router;