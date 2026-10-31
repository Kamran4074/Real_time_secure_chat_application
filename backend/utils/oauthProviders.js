// OAuth 2.0 provider settings. A provider is enabled when its
// <NAME>_CLIENT_ID and <NAME>_CLIENT_SECRET env variables are set.

const readJson = async(res, what)=>{
    if(!res.ok) throw new Error(`${what} failed with HTTP ${res.status}`);
    return res.json();
};

// Every provider's getProfile returns the same shape:
// { id, email, emailVerified, name, username, avatar }
const providers = {
    google: {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        extraAuthParams: { prompt: 'select_account' },
        async getProfile(accessToken){
            const p = await readJson(await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            }), 'Google profile');
            return {
                id: String(p.sub),
                email: p.email,
                emailVerified: p.email_verified === true,
                name: p.name,
                username: p.email?.split('@')[0],
                avatar: p.picture
            };
        }
    },
    github: {
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'read:user user:email',
        extraAuthParams: {},
        async getProfile(accessToken){
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'ChatWave'
            };
            const [user, emails] = await Promise.all([
                fetch('https://api.github.com/user', {headers}).then(r => readJson(r, 'GitHub profile')),
                fetch('https://api.github.com/user/emails', {headers}).then(r => readJson(r, 'GitHub emails'))
            ]);
            // the public profile email may be empty or unverified; use the verified primary one
            const primary = Array.isArray(emails) ? emails.find(e => e.primary && e.verified) : null;
            return {
                id: String(user.id),
                email: primary?.email,
                emailVerified: Boolean(primary),
                name: user.name || user.login,
                username: user.login,
                avatar: user.avatar_url
            };
        }
    }
};

const envKey = (name)=> name.toUpperCase();

export const getProvider = (name)=> Object.hasOwn(providers, name) ? providers[name] : null;

export const getCredentials = (name)=> ({
    clientId: process.env[`${envKey(name)}_CLIENT_ID`],
    clientSecret: process.env[`${envKey(name)}_CLIENT_SECRET`]
});

export const isEnabled = (name)=>{
    const {clientId, clientSecret} = getCredentials(name);
    return Boolean(getProvider(name) && clientId && clientSecret);
};

export const enabledProviders = ()=> Object.keys(providers).filter(isEnabled);

// Swap the authorization code for an access token (server-to-server, uses the client secret)
export const exchangeCode = async(name, code, redirectUri)=>{
    const provider = getProvider(name);
    const {clientId, clientSecret} = getCredentials(name);
    const res = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        })
    });
    const data = await readJson(res, 'Token exchange');
    if(!data.access_token) throw new Error(`Token exchange returned no access token (${data.error || 'unknown'})`);
    return data.access_token;
};
