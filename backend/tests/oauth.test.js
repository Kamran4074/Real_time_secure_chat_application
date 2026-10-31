import request from 'supertest';
import { app } from '../app.js';
import User from '../models/userModel.js';
import OAuthCode from '../models/oauthCodeModel.js';
import { startDb, stopDb, clearDb, auth } from './helpers.js';

const CLIENT_URL = 'http://localhost:5173';

// fake Google/GitHub servers: each test sets what they return
let googleProfile, githubUser, githubEmails, tokenStatus;
const realFetch = globalThis.fetch;

const json = (body, status = 200)=> new Response(JSON.stringify(body), {
    status, headers: {'Content-Type': 'application/json'}
});

beforeAll(async()=>{
    Object.assign(process.env, {
        GOOGLE_CLIENT_ID: 'google-id', GOOGLE_CLIENT_SECRET: 'google-secret',
        GITHUB_CLIENT_ID: 'github-id', GITHUB_CLIENT_SECRET: 'github-secret',
        SERVER_URL: 'http://localhost:3000', CLIENT_URL
    });
    globalThis.fetch = async(url, options)=>{
        const u = String(url);
        if(u.includes('oauth2.googleapis.com/token') || u.includes('github.com/login/oauth/access_token')){
            const body = new URLSearchParams(options.body);
            // the secret must only ever be sent here, server-to-server
            expect(body.get('client_secret')).toMatch(/secret/);
            return tokenStatus === 200 ? json({access_token: 'provider-token'}) : json({error: 'bad_verification_code'}, tokenStatus);
        }
        if(u.includes('openidconnect.googleapis.com')) return json(googleProfile);
        if(u.endsWith('api.github.com/user')) return json(githubUser);
        if(u.endsWith('api.github.com/user/emails')) return json(githubEmails);
        throw new Error(`unexpected fetch ${u}`);
    };
    await startDb();
});

afterAll(async()=>{
    globalThis.fetch = realFetch;
    await stopDb();
});

beforeEach(async()=>{
    await clearDb();
    tokenStatus = 200;
    googleProfile = {sub: 'g-123', email: 'Aisha.Khan@gmail.com', email_verified: true, name: 'Aisha Khan', picture: 'https://pic/aisha.png'};
    githubUser = {id: 987, login: 'rahul-dev', name: 'Rahul Verma', avatar_url: 'https://pic/rahul.png'};
    githubEmails = [
        {email: 'old@example.com', primary: false, verified: true},
        {email: 'rahul@example.com', primary: true, verified: true}
    ];
});

// step 1: start login, remember state + cookie like a browser would
const start = async(provider)=>{
    const res = await request(app).get(`/api/auth/${provider}`);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    const cookie = res.headers['set-cookie'].find(c => c.startsWith('oauth_state='));
    return {location, state: location.searchParams.get('state'), cookie: cookie.split(';')[0], rawCookie: cookie};
};

// step 2: provider redirects back
const callback = (provider, {state, cookie}, extra = {})=> {
    const req = request(app).get(`/api/auth/${provider}/callback`).query({code: 'auth-code', state, ...extra});
    return cookie ? req.set('Cookie', cookie) : req;
};

const redirectParams = (res)=>{
    const url = new URL(res.headers.location);
    expect(url.origin).toBe(CLIENT_URL);
    return url.searchParams;
};

// full happy path -> login response
const loginWith = async(provider)=>{
    const flow = await start(provider);
    const res = await callback(provider, flow);
    const code = redirectParams(res).get('oauth_code');
    expect(code).toMatch(/^[a-f0-9]{64}$/);
    return request(app).post('/api/auth/oauth/exchange').send({code});
};

describe('GET /api/auth/providers', ()=>{
    test('lists configured providers only', async()=>{
        let res = await request(app).get('/api/auth/providers');
        expect(res.body.providers).toEqual(['google', 'github']);

        delete process.env.GITHUB_CLIENT_SECRET;
        res = await request(app).get('/api/auth/providers');
        expect(res.body.providers).toEqual(['google']);
        process.env.GITHUB_CLIENT_SECRET = 'github-secret';
    });
});

describe('GET /api/auth/:provider (start)', ()=>{
    test('redirects to Google with client id, callback url, scope and state', async()=>{
        const {location, state, rawCookie} = await start('google');
        expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
        expect(location.searchParams.get('client_id')).toBe('google-id');
        expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
        expect(location.searchParams.get('scope')).toBe('openid email profile');
        expect(location.searchParams.get('response_type')).toBe('code');
        expect(state).toMatch(/^[a-f0-9]{48}$/);
        // secret never goes to the browser
        expect(location.href).not.toContain('secret');
        expect(rawCookie).toMatch(/HttpOnly/);
        expect(rawCookie).toMatch(/SameSite=Lax/);
    });

    test('redirects to GitHub', async()=>{
        const {location} = await start('github');
        expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
        expect(location.searchParams.get('scope')).toBe('read:user user:email');
    });

    test('unknown or unconfigured provider -> 404', async()=>{
        expect((await request(app).get('/api/auth/facebook')).status).toBe(404);
        expect((await request(app).get('/api/auth/__proto__')).status).toBe(404);
    });
});

describe('GET /api/auth/:provider/callback', ()=>{
    test('wrong state -> invalid_state, no user created', async()=>{
        const flow = await start('google');
        const res = await callback('google', {...flow, state: 'f'.repeat(48)});
        expect(redirectParams(res).get('oauth_error')).toBe('invalid_state');
        expect(await User.countDocuments()).toBe(0);
    });

    test('missing state cookie (CSRF attempt) -> invalid_state', async()=>{
        const flow = await start('google');
        const res = await callback('google', {state: flow.state, cookie: null});
        expect(redirectParams(res).get('oauth_error')).toBe('invalid_state');
    });

    test('state from another provider is rejected', async()=>{
        const flow = await start('github');
        const res = await callback('google', flow);
        expect(redirectParams(res).get('oauth_error')).toBe('invalid_state');
    });

    test('user cancelled on the consent screen -> cancelled', async()=>{
        const flow = await start('google');
        const res = await callback('google', flow, {error: 'access_denied'});
        expect(redirectParams(res).get('oauth_error')).toBe('cancelled');
    });

    test('unverified email -> email_not_verified, no user created', async()=>{
        googleProfile.email_verified = false;
        const flow = await start('google');
        const res = await callback('google', flow);
        expect(redirectParams(res).get('oauth_error')).toBe('email_not_verified');
        expect(await User.countDocuments()).toBe(0);
    });

    test('provider rejects the code -> server_error', async()=>{
        tokenStatus = 400;
        const flow = await start('google');
        const res = await callback('google', flow);
        expect(redirectParams(res).get('oauth_error')).toBe('server_error');
    });

    test('the JWT is never put in the redirect url', async()=>{
        const flow = await start('google');
        const res = await callback('google', flow);
        expect(res.headers.location).not.toMatch(/token|eyJ/);
    });
});

describe('Google sign-in', ()=>{
    test('creates a new user and logs them in', async()=>{
        const res = await loginWith('google');

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.email).toBe('aisha.khan@gmail.com');
        expect(res.body.fullname).toBe('Aisha Khan');
        expect(res.body.username).toBe('aisha.khan');
        expect(res.body.profilepic).toBe('https://pic/aisha.png');

        const user = await User.findOne({googleId: 'g-123'});
        expect(user.password).toBeUndefined();

        // the token works like a normal login token
        const me = await request(app).get('/api/user/currentchatters').set(auth(res.body.token));
        expect(me.status).toBe(200);
    });

    test('signing in again reuses the same account', async()=>{
        const first = await loginWith('google');
        const second = await loginWith('google');
        expect(second.body._id).toBe(first.body._id);
        expect(await User.countDocuments()).toBe(1);
    });

    test('links to an existing password account with the same email', async()=>{
        await request(app).post('/api/auth/register').send({
            fullname: 'Aisha K', username: 'aisha', email: 'aisha.khan@gmail.com', gender: 'female', password: 'secret123'
        });
        const res = await loginWith('google');

        expect(res.body.username).toBe('aisha'); // same account
        expect(await User.countDocuments()).toBe(1);

        // password login still works for the linked account
        const pw = await request(app).post('/api/auth/login').send({email: 'aisha.khan@gmail.com', password: 'secret123'});
        expect(pw.status).toBe(200);
    });

    test('OAuth-only account cannot log in with a password', async()=>{
        await loginWith('google');
        const res = await request(app).post('/api/auth/login').send({email: 'aisha.khan@gmail.com', password: ''});
        expect(res.status).toBe(400);
        const res2 = await request(app).post('/api/auth/login').send({email: 'aisha.khan@gmail.com', password: 'anything'});
        expect(res2.body.message).toBe('Invalid email or password');
    });
});

describe('GitHub sign-in', ()=>{
    test('uses the verified primary email and the GitHub login as username', async()=>{
        const res = await loginWith('github');
        expect(res.status).toBe(200);
        expect(res.body.email).toBe('rahul@example.com');
        expect(res.body.username).toBe('rahuldev');
        expect(await User.exists({githubId: '987'})).toBeTruthy();
    });

    test('no verified primary email -> email_not_verified', async()=>{
        githubEmails = [{email: 'rahul@example.com', primary: true, verified: false}];
        const flow = await start('github');
        const res = await callback('github', flow);
        expect(redirectParams(res).get('oauth_error')).toBe('email_not_verified');
    });

    test('adds digits when the username is already taken', async()=>{
        await request(app).post('/api/auth/register').send({
            fullname: 'Other', username: 'rahuldev', email: 'other@test.com', gender: 'male', password: 'secret123'
        });
        const res = await loginWith('github');
        expect(res.body.username).toMatch(/^rahuldev\d{4}$/);
    });
});

describe('POST /api/auth/oauth/exchange', ()=>{
    test('a code can only be used once', async()=>{
        const flow = await start('google');
        const code = redirectParams(await callback('google', flow)).get('oauth_code');

        const first = await request(app).post('/api/auth/oauth/exchange').send({code});
        const second = await request(app).post('/api/auth/oauth/exchange').send({code});
        expect(first.status).toBe(200);
        expect(second.status).toBe(400);
    });

    test('an expired code is rejected', async()=>{
        const flow = await start('google');
        const code = redirectParams(await callback('google', flow)).get('oauth_code');
        await OAuthCode.updateMany({}, {expiresAt: new Date(Date.now() - 1000)});

        const res = await request(app).post('/api/auth/oauth/exchange').send({code});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/expired/);
    });

    test.each([
        ['missing', {}],
        ['not hex', {code: 'x'.repeat(64)}],
        ['object (NoSQL injection)', {code: {$ne: null}}],
        ['unknown', {code: 'a'.repeat(64)}],
    ])('rejects a %s code', async(_, body)=>{
        const res = await request(app).post('/api/auth/oauth/exchange').send(body);
        expect(res.status).toBe(400);
    });
});
