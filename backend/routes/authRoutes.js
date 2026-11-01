import express from "express";
import { userLogin, userLogout, userLogoutAll, userRegister } from "../controllers/authController.js";
import { listProviders, startOAuth, oauthCallback, exchangeOAuthCode } from "../controllers/oauthController.js";
import { forgotPassword, resetPassword, changePassword } from "../controllers/passwordController.js";
import isLogin from "../middleware/isLogin.js";
import validate from "../middleware/validate.js";
import { registerSchema, loginSchema, oauthExchangeSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from "../validation/schemas.js";

const router = express.Router();

router.post('/register',validate({body:registerSchema}),userRegister);
router.post('/login',validate({body:loginSchema}),userLogin);
router.post('/logout',isLogin,userLogout);
router.post('/logout-all',isLogin,userLogoutAll);
// while logged in (rate limited like login in app.js: it checks the current password)
router.post('/change-password',isLogin,validate({body:changePasswordSchema}),changePassword);

// password reset by email (rate limited with the other auth routes in app.js)
router.post('/forgot-password',validate({body:forgotPasswordSchema}),forgotPassword);
router.post('/reset-password',validate({body:resetPasswordSchema}),resetPassword);

// OAuth 2.0 (Google / GitHub)
router.get('/providers',listProviders);
router.post('/oauth/exchange',validate({body:oauthExchangeSchema}),exchangeOAuthCode);
router.get('/:provider',startOAuth);
router.get('/:provider/callback',oauthCallback);

export default router;
