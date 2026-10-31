import express from "express";
import { userLogin, userLogout, userRegister } from "../controllers/authController.js";
import { listProviders, startOAuth, oauthCallback, exchangeOAuthCode } from "../controllers/oauthController.js";
import isLogin from "../middleware/isLogin.js";
import validate from "../middleware/validate.js";
import { registerSchema, loginSchema, oauthExchangeSchema } from "../validation/schemas.js";

const router = express.Router();

router.post('/register',validate({body:registerSchema}),userRegister);
router.post('/login',validate({body:loginSchema}),userLogin);
router.post('/logout',isLogin,userLogout);

// OAuth 2.0 (Google / GitHub)
router.get('/providers',listProviders);
router.post('/oauth/exchange',validate({body:oauthExchangeSchema}),exchangeOAuthCode);
router.get('/:provider',startOAuth);
router.get('/:provider/callback',oauthCallback);

export default router;
