import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import escapeRegex from '../utils/escapeRegex.js';
import jwtToken, { cookieOptions, isTokenError } from '../utils/jwt.js';
import { errorMeta } from '../utils/logger.js';
import { getProvider, getCredentials, isEnabled, enabledProviders, exchangeCode } from '../utils/oauthProviders.js';

// Unit tests: plain functions, no server and no database

describe('escapeRegex', ()=>{
    test('escapes every regex special character', ()=>{
        const escaped = escapeRegex('a.b*c+?^${}()|[]\\');
        expect(new RegExp(`^${escaped}$`).test('a.b*c+?^${}()|[]\\')).toBe(true);
    });

    test('escaped input no longer acts as a pattern', ()=>{
        expect(new RegExp(escapeRegex('.*')).test('anything')).toBe(false);
    });

    test('leaves normal text unchanged and converts non-strings', ()=>{
        expect(escapeRegex('john_doe')).toBe('john_doe');
        expect(escapeRegex(123)).toBe('123');
    });
});

describe('jwt helpers', ()=>{
    test('jwtToken signs a 7-day token with a jti and sets it as a secure cookie', ()=>{
        const res = { cookie: jest.fn() };
        const token = jwtToken('user123', res);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.userId).toBe('user123');
        expect(decoded.jti).toEqual(expect.any(String));
        expect(decoded.exp - decoded.iat).toBe(7*24*60*60);

        expect(res.cookie).toHaveBeenCalledWith('jwt', token, expect.objectContaining({
            ...cookieOptions,
            maxAge: 7*24*60*60*1000
        }));
    });

    test('every token gets a different jti', ()=>{
        const res = { cookie: jest.fn() };
        const a = jwt.decode(jwtToken('u', res));
        const b = jwt.decode(jwtToken('u', res));
        expect(a.jti).not.toBe(b.jti);
    });

    test('isTokenError recognises only token problems', ()=>{
        expect(isTokenError({name: 'JsonWebTokenError'})).toBe(true);
        expect(isTokenError({name: 'TokenExpiredError'})).toBe(true);
        expect(isTokenError({name: 'AuthTokenError'})).toBe(true);
        expect(isTokenError(new Error('db down'))).toBe(false);
        expect(isTokenError(undefined)).toBe(false);
    });
});

describe('errorMeta', ()=>{
    test('keeps message and stack of an Error', ()=>{
        const meta = errorMeta(new Error('boom'));
        expect(meta.error).toBe('boom');
        expect(meta.stack).toContain('boom');
    });

    test('stringifies anything else', ()=>{
        expect(errorMeta('oops')).toEqual({error: 'oops'});
    });
});

describe('oauthProviders', ()=>{
    const ORIGINAL_ENV = { ...process.env };
    const realFetch = global.fetch;

    beforeEach(()=>{
        process.env = { ...ORIGINAL_ENV, GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' };
        delete process.env.GITHUB_CLIENT_ID;
        delete process.env.GITHUB_CLIENT_SECRET;
    });

    afterEach(()=>{
        process.env = { ...ORIGINAL_ENV };
        global.fetch = realFetch;
    });

    test('getProvider returns known providers only (no prototype keys)', ()=>{
        expect(getProvider('google')).not.toBeNull();
        expect(getProvider('facebook')).toBeNull();
        expect(getProvider('__proto__')).toBeNull();
    });

    test('getCredentials reads <NAME>_CLIENT_ID / _SECRET', ()=>{
        expect(getCredentials('google')).toEqual({clientId: 'gid', clientSecret: 'gsecret'});
    });

    test('a provider is enabled only when both id and secret are set', ()=>{
        expect(isEnabled('google')).toBe(true);
        expect(isEnabled('github')).toBe(false);
        process.env.GITHUB_CLIENT_ID = 'only-id';
        expect(isEnabled('github')).toBe(false);
        expect(enabledProviders()).toEqual(['google']);
    });

    test('exchangeCode posts the code and returns the access token', async()=>{
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async()=> ({access_token: 'tok'}) });

        await expect(exchangeCode('google', 'the-code', 'http://cb')).resolves.toBe('tok');

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe(getProvider('google').tokenUrl);
        expect(options.method).toBe('POST');
        const body = new URLSearchParams(options.body);
        expect(body.get('code')).toBe('the-code');
        expect(body.get('client_secret')).toBe('gsecret');
        expect(body.get('grant_type')).toBe('authorization_code');
    });

    test('exchangeCode fails on HTTP error or missing token', async()=>{
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
        await expect(exchangeCode('google', 'c', 'u')).rejects.toThrow('HTTP 401');

        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async()=> ({error: 'bad_verification_code'}) });
        await expect(exchangeCode('google', 'c', 'u')).rejects.toThrow('bad_verification_code');
    });

    test('Google profile is mapped to the common shape', async()=>{
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async()=> ({
            sub: 42, email: 'aisha@x.com', email_verified: true, name: 'Aisha Khan', picture: 'pic.png'
        }) });

        await expect(getProvider('google').getProfile('tok')).resolves.toEqual({
            id: '42', email: 'aisha@x.com', emailVerified: true, name: 'Aisha Khan', username: 'aisha', avatar: 'pic.png'
        });
    });

    test('GitHub profile uses the verified primary email', async()=>{
        global.fetch = jest.fn(async(url)=> ({ ok: true, json: async()=> url.endsWith('/emails')
            ? [{email: 'old@x.com', primary: false, verified: true}, {email: 'main@x.com', primary: true, verified: true}]
            : {id: 7, login: 'octo', name: null, avatar_url: 'a.png'} }));

        const profile = await getProvider('github').getProfile('tok');
        expect(profile).toMatchObject({id: '7', email: 'main@x.com', emailVerified: true, name: 'octo', username: 'octo'});
    });
});
