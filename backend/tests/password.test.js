import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../app.js';
import PasswordReset from '../models/passwordResetModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

const ORIGINAL_ENV = { ...process.env };
const realFetch = globalThis.fetch;
let sentEmails;
let brevoStatus;

beforeAll(startDb);
afterAll(async()=>{
    process.env = { ...ORIGINAL_ENV };
    globalThis.fetch = realFetch;
    await stopDb();
});

beforeEach(async()=>{
    await clearDb();
    Object.assign(process.env, { BREVO_API_KEY: 'test-key', EMAIL_FROM: 'no-reply@chatwave.test', CLIENT_URL: 'http://localhost:5173' });
    sentEmails = [];
    brevoStatus = 201;
    // fake Brevo API
    globalThis.fetch = jest.fn(async(url, options)=>{
        expect(String(url)).toBe('https://api.brevo.com/v3/smtp/email');
        expect(options.headers['api-key']).toBe('test-key');
        sentEmails.push(JSON.parse(options.body));
        return new Response(brevoStatus < 300 ? '{"messageId":"1"}' : '{"message":"Key not found"}', {status: brevoStatus});
    });
});

const forgot = (email)=> request(app).post('/api/auth/forgot-password').send({email});
const reset = (token, password)=> request(app).post('/api/auth/reset-password').send({token, password});
// the token is only in the email, like for a real user
const tokenFromEmail = (email)=> email.textContent.match(/token=([a-f0-9]{64})/)[1];

describe('POST /api/auth/forgot-password', ()=>{
    test('emails a reset link to the account owner and stores only a hash', async()=>{
        await registerUser(app, {email: 'aisha@test.com', fullname: 'Aisha Khan'});

        const res = await forgot('AISHA@test.com');

        expect(res.status).toBe(200);
        expect(sentEmails).toHaveLength(1);
        const [email] = sentEmails;
        expect(email.to).toEqual([{email: 'aisha@test.com'}]);
        expect(email.sender.email).toBe('no-reply@chatwave.test');
        expect(email.htmlContent).toContain('http://localhost:5173/reset-password?token=');

        const token = tokenFromEmail(email);
        const saved = await PasswordReset.findOne();
        expect(saved.tokenHash).not.toBe(token);
        expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29*60*1000);
    });

    test('gives the same answer for an unknown email and sends nothing', async()=>{
        await registerUser(app, {email: 'aisha@test.com'});
        const known = await forgot('aisha@test.com');
        const unknown = await forgot('nobody@test.com');

        expect(unknown.status).toBe(200);
        expect(unknown.body).toEqual(known.body);
        expect(sentEmails).toHaveLength(1);
    });

    test('a new request replaces the previous link', async()=>{
        await registerUser(app, {email: 'aisha@test.com'});
        await forgot('aisha@test.com');
        await forgot('aisha@test.com');

        expect(await PasswordReset.countDocuments()).toBe(1);
        expect((await reset(tokenFromEmail(sentEmails[0]), 'newpass1')).status).toBe(400);
        expect((await reset(tokenFromEmail(sentEmails[1]), 'newpass1')).status).toBe(200);
    });

    test('still answers 200 when Brevo fails', async()=>{
        await registerUser(app, {email: 'aisha@test.com'});
        brevoStatus = 401;
        expect((await forgot('aisha@test.com')).status).toBe(200);
    });

    test('without Brevo keys nothing is sent', async()=>{
        delete process.env.BREVO_API_KEY;
        await registerUser(app, {email: 'aisha@test.com'});
        expect((await forgot('aisha@test.com')).status).toBe(200);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test.each([[''], ['not-an-email'], [{$ne: null}]])('rejects invalid email %p', async(email)=>{
        expect((await forgot(email)).status).toBe(400);
    });

    test('HTML in the user name is escaped in the email', async()=>{
        await registerUser(app, {email: 'x@test.com', fullname: '<script>alert(1)</script>'});
        await forgot('x@test.com');
        expect(sentEmails[0].htmlContent).not.toContain('<script>');
    });
});

describe('POST /api/auth/reset-password', ()=>{
    let user;
    beforeEach(async()=>{
        user = await registerUser(app, {email: 'aisha@test.com', password: 'oldpass1'});
        await forgot('aisha@test.com');
    });

    test('sets the new password: new one works, old one does not', async()=>{
        const res = await reset(tokenFromEmail(sentEmails[0]), 'newpass1');
        expect(res.status).toBe(200);

        const login = (password)=> request(app).post('/api/auth/login').send({email: 'aisha@test.com', password});
        expect((await login('oldpass1')).status).toBe(400);
        expect((await login('newpass1')).status).toBe(200);
    });

    test('the link works only once', async()=>{
        const token = tokenFromEmail(sentEmails[0]);
        expect((await reset(token, 'newpass1')).status).toBe(200);
        const again = await reset(token, 'another1');
        expect(again.status).toBe(400);
        expect(again.body.message).toMatch(/invalid or has expired/);
    });

    test('an expired link is rejected', async()=>{
        await PasswordReset.updateMany({}, {expiresAt: new Date(Date.now() - 1000)});
        expect((await reset(tokenFromEmail(sentEmails[0]), 'newpass1')).status).toBe(400);
    });

    test('logs out every existing session', async()=>{
        // JWT iat has 1-second precision: make sure the reset happens in a later second
        await new Promise(r => setTimeout(r, 1100));
        await reset(tokenFromEmail(sentEmails[0]), 'newpass1');

        const res = await request(app).get('/api/user/currentchatters').set(auth(user.token));
        expect(res.status).toBe(401);

        const fresh = await request(app).post('/api/auth/login').send({email: 'aisha@test.com', password: 'newpass1'});
        expect((await request(app).get('/api/user/currentchatters').set(auth(fresh.body.token))).status).toBe(200);
    });

    test.each([
        ['a malformed token', 'abc', 'newpass1', /Invalid reset link/],
        ['an unknown token', 'f'.repeat(64), 'newpass1', /invalid or has expired/],
        ['a short password', 'f'.repeat(64), '123', /6-72/],
    ])('rejects %s', async(_, token, password, message)=>{
        const res = await reset(token, password);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(message);
    });
});
