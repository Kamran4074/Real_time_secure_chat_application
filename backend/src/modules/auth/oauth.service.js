import crypto from "crypto";
import { User, defaultAvatar, findByEmail, isUsernameTaken } from "../users/index.js";
import OAuthCode from "./models/oauthCode.model.js";
import { createToken } from "./session.js";
import { getProvider, getCredentials, isEnabled, enabledProviders, exchangeCode } from "./oauth.providers.js";
import { AppError } from "../../shared/errors.js";
import { sha256, randomToken, safeEqual } from "../../shared/crypto.js";
import logger from "../../shared/logger.js";
import { serverUrl } from "../../config/urls.js";

// OAuth 2.0 authorization-code flow (Google / GitHub):
//   1. startAuthorization: redirect URL + random state (the controller stores the state in a cookie)
//   2. completeAuthorization: check the state, swap the provider code for a profile, find/create the user,
//      hand the frontend a short-lived one-time code (so the JWT never appears in a URL)
//   3. exchangeLoginCode: the frontend swaps that code for a normal session

const CODE_TTL_MS = 60*1000;

// A sign-in that must end with a redirect to the frontend showing `reason`
export class OAuthFailure extends Error {
    constructor(reason){
        super(`OAuth failed: ${reason}`);
        this.reason = reason;
    }
}

const redirectUri = (name)=> `${serverUrl()}/api/auth/${name}/callback`;

export const listProviders = ()=> enabledProviders();

// "Aisha Khan" / "aisha.k@x.com" -> "aishak", then add digits until it's free
const uniqueUsername = async(raw)=>{
    let base = String(raw || '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 15);
    if(base.length < 3) base = `user${base}`;
    for(let i = 0; i < 10; i++){
        const candidate = i === 0 ? base : `${base}${crypto.randomInt(1000, 10000)}`;
        if(!(await isUsernameTaken(candidate))) return candidate;
    }
    return `user${Date.now().toString(36)}`;
};

const findOrCreateUser = async(name, profile)=>{
    const idField = `${name}Id`;

    // 1. returning user
    let user = await User.findOne({[idField]: profile.id});
    if(user) return user;

    // 2. existing account with the same verified email -> link it
    user = await findByEmail(profile.email);
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
        profilepic: profile.avatar || defaultAvatar(username)
    });
    logger.info('User registered via OAuth', {provider: name, userId: created._id.toString()});
    return created;
};

//----------------------
// step 1
//----------------------
export const startAuthorization = (name)=>{
    if(!isEnabled(name)){
        throw new AppError(404, 'AUTH_PROVIDER_UNAVAILABLE', "Sign-in provider not available");
    }
    const provider = getProvider(name);
    // random state ties the callback to this browser (CSRF protection)
    const state = randomToken(24);
    const params = new URLSearchParams({
        client_id: getCredentials(name).clientId,
        redirect_uri: redirectUri(name),
        response_type: 'code',
        scope: provider.scope,
        state,
        ...provider.extraAuthParams
    });
    return {url: `${provider.authorizeUrl}?${params}`, state: `${name}:${state}`};
};

//----------------------
// step 2: the provider sent the user back. savedState is what step 1 stored in the browser.
// Returns the one-time code for the frontend; throws OAuthFailure.
//----------------------
export const completeAuthorization = async(name, {code, state, error}, savedState)=>{
    if(!isEnabled(name)) throw new OAuthFailure('unavailable');
    if(error) throw new OAuthFailure('cancelled'); // user pressed "Cancel" on the consent screen
    if(typeof code !== 'string' || typeof state !== 'string' || !savedState || !safeEqual(savedState, `${name}:${state}`)){
        throw new OAuthFailure('invalid_state');
    }

    const accessToken = await exchangeCode(name, code, redirectUri(name));
    const profile = await getProvider(name).getProfile(accessToken);
    if(!profile.id || !profile.email || !profile.emailVerified) throw new OAuthFailure('email_not_verified');

    const user = await findOrCreateUser(name, profile);

    // short-lived, single-use code; only its hash is stored
    const oneTimeCode = randomToken(32);
    await OAuthCode.create({
        codeHash: sha256(oneTimeCode),
        userId: user._id,
        expiresAt: new Date(Date.now() + CODE_TTL_MS)
    });
    logger.info('OAuth sign-in succeeded', {provider: name, userId: user._id.toString()});
    return oneTimeCode;
};

//----------------------
// step 3 (code is a 64-char hex string, oauthExchangeSchema)
//----------------------
export const exchangeLoginCode = async(code)=>{
    // findOneAndDelete makes the code single-use
    const entry = await OAuthCode.findOneAndDelete({codeHash: sha256(code), expiresAt: {$gt: new Date()}});
    if(!entry) throw new AppError(400, 'AUTH_OAUTH_CODE_EXPIRED', "Sign-in link expired, please try again");

    const user = await User.findById(entry.userId);
    if(!user) throw new AppError(400, 'AUTH_ACCOUNT_NOT_FOUND', "Account not found");

    return {user, token: createToken(user._id)};
};
