import express from "express";
import requireAuth from "./requireAuth.js";
import validate from "../../shared/middleware/validate.js";
import { apiLimiter, authLimiter } from "../../shared/middleware/rateLimiters.js";
import { registerSchema, loginSchema, oauthExchangeSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from "./auth.schemas.js";
import * as controller from "./auth.controller.js";

export const basePath = '/auth';
export const router = express.Router();

// overall cap per IP, shared by every module (stricter limits are added per route below)
router.use(apiLimiter);

// authLimiter: slows down password guessing / email flooding on every route that checks a secret or sends mail
router.post('/register', authLimiter, validate({body: registerSchema}), controller.register);
router.post('/login', authLimiter, validate({body: loginSchema}), controller.login);
router.post('/logout', requireAuth, controller.logout);
router.post('/logout-all', requireAuth, controller.logoutEverywhere);
router.post('/change-password', authLimiter, requireAuth, validate({body: changePasswordSchema}), controller.changePassword);

// password reset by email
router.post('/forgot-password', authLimiter, validate({body: forgotPasswordSchema}), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate({body: resetPasswordSchema}), controller.resetPassword);

// OAuth 2.0 (Google / GitHub)
router.get('/providers', controller.listProviders);
router.post('/oauth/exchange', authLimiter, validate({body: oauthExchangeSchema}), controller.exchangeOAuthCode);
router.get('/:provider', controller.startOAuth);
router.get('/:provider/callback', controller.oauthCallback);
