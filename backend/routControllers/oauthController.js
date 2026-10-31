import crypto from "crypto";
import User from "../Models/userModels.js";
import OAuthCode from "../Models/oauthCodeModel.js";
import jwtToken from "../utils/jwtwebTokens.js";
import escapeRegex from "../utils/escapeRegex.js";
import allowedOrigins from "../utils/allowedOrigins.js";
import logger, { errorMeta } from "../utils/logger.js";
import { getProvider, getCredentials, isEnabled, enabledProviders, exchangeCode } from "../utils/oauthProviders.js";

const STATE_COOKIE = 'oauth_state';
const CODE_TTL_MS = 60*1000;

const trimSlash = (url)=> url.replace(/\/+$/, '');
// where this backend is reachable (used in the redirect_uri registered with Google/GitHub)
const serverUrl = ()=> trimSlash(process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`);
// where to send the user back after login
const clientUrl = ()=> trimSlash(process.env.CLIENT_URL || allowedOrigins[0]);
const redirectUri = (name)=> `${serverUrl()}/api/auth/${name}/callback`;

// lax: the cookie must survive the top-level redirect back from Google/GitHub
const stateCookieOptions = ()=> ({
    httpOnly: true,
    sameSite: 'lax',
    secure: serverUrl().startsWith('https'),
    path: '/api/auth'
});

const sha256 = (value)=> crypto.createHash('sha256').update(value).digest('hex');

const sameString = (a, b)=>{
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// "Aisha Khan" / "aisha.k@x.com" -> "aishak", then add digits until it's free
const uniqueUsername = async(raw)=>{
    let base = String(raw || '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 15);
    if(base.length < 3) base = `user${base}`;
    for(let i = 0; i < 10; i++){
        const candidate = i === 0 ? base : `${base}${crypto.randomInt(1000, 10000)}`;
        const taken = await User.exists({username: {$regex: `^${escapeRegex(candidate)}$`, $options: 'i'}});
        if(!taken) return candidate;
    }
    return `user${Date.now().toString(36)}`;
};

const findOrCreateUser = async(name, profile)=>{
    const idField = `${name}Id`;

    // 1. returning user
    let user = await User.findOne({[idField]: profile.id});
    if(user) return user;

    // 2. existing account with the same verified email -> link it
    user = await User.findOne({email: {$regex: `^${escapeRegex(profile.email)}$`, $options: 'i'}});
    if(user){
        user[idField] = profile.id;
        if(!user.profilepic && profile.avatar) user.profilepic = profile.avatar;
        await user.save();
        logger.info('OAuth account linked to existing user', {provider: name, userId: user._id.toString()});
        return user;
    }

    // 3. brand new user
    const username = await uniqueUsername(profile.username || profile.name || profile.email.split('@')[0]);
    const created = await User.create({
        fullname: (profile.name || username).trim().slice(0, 60),
        username,
        email: profile.email.toLowerCase(),
        [idField]: profile.id,
        profilepic: profile.avatar || `https://avatar.iran.liara.run/public?username=${encodeURIComponent(username)}`
    });
    logger.info('User registered via OAuth', {provider: name, userId: created._id.toString()});
    return created;
};

//----------------------
// which buttons the frontend should enable
//----------------------
export const listProviders = (req, res)=>{
    res.status(200).send({providers: enabledProviders()});
};

//----------------------
// step 1: send the user to Google / GitHub
//----------------------
export const startOAuth = (req, res)=>{
    const name = req.params.provider;
    if(!isEnabled(name)){
        return res.status(404).send({success:false, message:"Sign-in provider not available"});
    }
    const provider = getProvider(name);

    // random state ties the callback to this browser (CSRF protection)
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, `${name}:${state}`, {...stateCookieOptions(), maxAge: 10*60*1000});

    const params = new URLSearchParams({
        client_id: getCredentials(name).clientId,
        redirect_uri: redirectUri(name),
        response_type: 'code',
        scope: provider.scope,
        state,
        ...provider.extraAuthParams
    });
    res.redirect(`${provider.authorizeUrl}?${params}`);
};

//----------------------
// step 2: provider sends the user back here
//----------------------
export const oauthCallback = async(req, res)=>{
    const name = req.params.provider;
    const savedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, stateCookieOptions());

    const fail = (reason)=>{
        logger.warn('OAuth sign-in failed', {requestId: req.id, provider: name, reason});
        res.redirect(`${clientUrl()}/?oauth_error=${reason}`);
    };

    if(!isEnabled(name)) return fail('unavailable');
    if(req.query.error) return fail('cancelled'); // user pressed "Cancel" on the consent screen

    const {code, state} = req.query;
    if(typeof code !== 'string' || typeof state !== 'string' || !savedState || !sameString(savedState, `${name}:${state}`)){
        return fail('invalid_state');
    }

    try {
        const accessToken = await exchangeCode(name, code, redirectUri(name));
        const profile = await getProvider(name).getProfile(accessToken);
        if(!profile.id || !profile.email || !profile.emailVerified) return fail('email_not_verified');

        const user = await findOrCreateUser(name, profile);

        // short-lived, single-use code; only its hash is stored
        const oneTimeCode = crypto.randomBytes(32).toString('hex');
        await OAuthCode.create({
            codeHash: sha256(oneTimeCode),
            userId: user._id,
            expiresAt: new Date(Date.now() + CODE_TTL_MS)
        });
        logger.info('OAuth sign-in succeeded', {requestId: req.id, provider: name, userId: user._id.toString()});
        res.redirect(`${clientUrl()}/?oauth_code=${oneTimeCode}`);
    } catch (error) {
        logger.error(`OAuth ${name} error`, {requestId: req.id, ...errorMeta(error)});
        fail('server_error');
    }
};

//----------------------
// step 3: frontend swaps the one-time code for a normal login response
//----------------------
// code is a 64-char hex string (oauthExchangeSchema)
export const exchangeOAuthCode = async(req, res)=>{
    const {code} = req.body;

    // findOneAndDelete makes the code single-use
    const entry = await OAuthCode.findOneAndDelete({codeHash: sha256(code), expiresAt: {$gt: new Date()}});
    if(!entry) return res.status(400).send({success:false, message:"Sign-in link expired, please try again"});

    const user = await User.findById(entry.userId);
    if(!user) return res.status(400).send({success:false, message:"Account not found"});

    const token = jwtToken(user._id, res);
    res.status(200).send({
        _id:user._id,
        fullname:user.fullname,
        username:user.username,
        profilepic:user.profilepic,
        email:user.email,
        token,
        message:"Logged in successfully"
    });
};
