// HTTP side of a session: the token also travels as an httpOnly cookie.
// The same options must be used when clearing the cookie, or the browser ignores it.
export const SESSION_COOKIE = 'jwt';

export const cookieOptions = {
    httpOnly: true,
    sameSite: "none",
    secure: true
};

const MAX_AGE_MS = 7*24*60*60*1000; // same as the token lifetime

export const setSessionCookie = (res, token)=>{
    res.cookie(SESSION_COOKIE, token, {...cookieOptions, maxAge: MAX_AGE_MS});
};

export const clearSessionCookie = (res)=>{
    res.clearCookie(SESSION_COOKIE, cookieOptions);
};
