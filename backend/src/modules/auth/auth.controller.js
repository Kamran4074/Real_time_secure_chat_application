import * as auth from "./auth.service.js";
import * as password from "./password.service.js";
import * as oauth from "./oauth.service.js";
import { setSessionCookie, clearSessionCookie } from "./sessionCookie.js";
import logger, { errorMeta } from "../../shared/logger.js";
import { clientUrl, serverUrl } from "../../config/urls.js";

// HTTP in / out only (status, body, cookies, redirects): the rules live in the *.service.js files

// what the frontend stores after any kind of login
const sessionResponse = (user, token, message)=> ({
    _id: user._id,
    fullname: user.fullname,
    username: user.username,
    profilepic: user.profilepic,
    email: user.email,
    token,
    message
});

//----------------------
// register / login / logout
//----------------------
export const register = async(req, res)=>{
    const {user, token} = await auth.register(req.body);
    setSessionCookie(res, token);
    res.status(201).send(sessionResponse(user, token, "Registered successfully"));
};

export const login = async(req, res)=>{
    const {user, token} = await auth.login(req.body);
    setSessionCookie(res, token);
    res.status(200).send(sessionResponse(user, token, "Logged in successfully"));
};

export const logout = async(req, res)=>{
    await auth.logout(req.user._id, req.token);
    clearSessionCookie(res);
    res.status(200).send({message: "User logout"});
};

export const logoutEverywhere = async(req, res)=>{
    await auth.logoutEverywhere(req.user._id);
    clearSessionCookie(res);
    res.status(200).send({message: "Logged out from all devices"});
};

//----------------------
// passwords
//----------------------
export const forgotPassword = async(req, res)=>{
    await password.requestReset(req.body.email);
    // same answer whether or not the email exists, so this can't be used to find accounts
    res.status(200).send({success: true, message: "If an account exists for that email, a reset link is on its way"});
};

export const resetPassword = async(req, res)=>{
    await password.resetPassword(req.body.token, req.body.password);
    res.status(200).send({success: true, message: "Password updated, please log in"});
};

export const changePassword = async(req, res)=>{
    const {hadPassword, token} = await password.changePassword(req.user._id, req.body);
    setSessionCookie(res, token);
    res.status(200).send({success: true, message: hadPassword ? "Password changed" : "Password set", token});
};

//----------------------
// OAuth (Google / GitHub)
//----------------------
const STATE_COOKIE = 'oauth_state';
// lax: the cookie must survive the top-level redirect back from Google / GitHub
const stateCookieOptions = ()=> ({
    httpOnly: true,
    sameSite: 'lax',
    secure: serverUrl().startsWith('https'),
    path: '/api/auth'
});

// which buttons the frontend should enable
export const listProviders = (req, res)=>{
    res.status(200).send({providers: oauth.listProviders()});
};

export const startOAuth = (req, res)=>{
    const {url, state} = oauth.startAuthorization(req.params.provider);
    res.cookie(STATE_COOKIE, state, {...stateCookieOptions(), maxAge: 10*60*1000});
    res.redirect(url);
};

// Always ends with a redirect to the frontend: ?oauth_code=... on success, ?oauth_error=<reason> otherwise
export const oauthCallback = async(req, res)=>{
    const provider = req.params.provider;
    const savedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, stateCookieOptions());

    try {
        const code = await oauth.completeAuthorization(provider, req.query, savedState);
        res.redirect(`${clientUrl()}/?oauth_code=${code}`);
    } catch (error) {
        const reason = error instanceof oauth.OAuthFailure ? error.reason : 'server_error';
        if(reason === 'server_error') logger.error(`OAuth ${provider} error`, errorMeta(error));
        logger.warn('OAuth sign-in failed', {provider, reason});
        res.redirect(`${clientUrl()}/?oauth_error=${reason}`);
    }
};

export const exchangeOAuthCode = async(req, res)=>{
    const {user, token} = await oauth.exchangeLoginCode(req.body.code);
    setSessionCookie(res, token);
    res.status(200).send(sessionResponse(user, token, "Logged in successfully"));
};
