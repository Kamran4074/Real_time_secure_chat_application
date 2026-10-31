import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import User from '../models/userModel.js';
import Message from '../models/messageModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

// Security tests (OWASP Top 10 style): each test tries an attack and checks that it is blocked.
// More checks live next to their feature: rate limiting, ReDoS, revoked tokens, CORS, body size.

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('security headers (helmet)', ()=>{
    test('sets the standard protective headers and hides Express', async()=>{
        const res = await request(app).get('/');

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
        expect(res.headers['content-security-policy']).toBeDefined();
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});

describe('injection', ()=>{
    test('NoSQL operator injection in login is rejected', async()=>{
        await registerUser(app, {email: 'victim@test.com'});

        const res = await request(app).post('/api/auth/login')
            .send({email: {$gt: ''}, password: {$gt: ''}});

        expect(res.status).toBe(400);
        expect(res.body.token).toBeUndefined();
    });

    test('prototype pollution through the JSON body has no effect', async()=>{
        await request(app).post('/api/auth/register')
            .set('Content-Type', 'application/json')
            .send('{"fullname":"P","username":"proto","email":"p@test.com","gender":"male","password":"secret123","__proto__":{"isAdmin":true}}');

        expect({}.isAdmin).toBeUndefined();
    });

    test('mass assignment: client cannot choose its own _id or password hash', async()=>{
        const fakeId = '507f1f77bcf86cd799439011';
        const res = await request(app).post('/api/auth/register').send({
            fullname: 'Eve', username: 'eve', email: 'eve@test.com', gender: 'female',
            password: 'secret123', _id: fakeId
        });

        expect(res.status).toBe(201);
        expect(res.body._id).not.toBe(fakeId);
        const saved = await User.findOne({username: 'eve'});
        expect(saved.password).toMatch(/^\$2[aby]\$10\$/); // bcrypt, cost 10
    });
});

describe('cross-site scripting (XSS)', ()=>{
    test('HTML in a message is stored as plain text and served as JSON', async()=>{
        const alice = await registerUser(app);
        const bob = await registerUser(app);
        const payload = '<img src=x onerror=alert(1)>';

        await request(app).post(`/api/message/send/${bob._id}`).set(auth(alice.token)).send({messages: payload});
        const res = await request(app).get(`/api/message/${alice._id}`).set(auth(bob.token));

        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body[0].message).toBe(payload); // unchanged text; React escapes it when rendering
    });
});

describe('broken authentication', ()=>{
    test('a token with alg "none" is rejected', async()=>{
        const user = await registerUser(app);
        const unsigned = jwt.sign({userId: user._id, jti: 'x'}, '', {algorithm: 'none'});

        const res = await request(app).get('/api/user/currentchatters').set(auth(unsigned));
        expect(res.status).toBe(401);
    });

    test('a token signed with another secret is rejected', async()=>{
        const user = await registerUser(app);
        const forged = jwt.sign({userId: user._id, jti: 'x'}, 'attacker-secret');

        const res = await request(app).get('/api/user/currentchatters').set(auth(forged));
        expect(res.status).toBe(401);
    });

    test('a malformed Authorization header is rejected', async()=>{
        const res = await request(app).get('/api/user/currentchatters').set('Authorization', 'Bearer not.a.jwt');
        expect(res.status).toBe(401);
    });
});

describe('broken access control', ()=>{
    test('sender is always the logged-in user, even if the body says otherwise', async()=>{
        const alice = await registerUser(app);
        const bob = await registerUser(app);
        const mallory = await registerUser(app);

        // mallory tries to send a message "from alice" to bob
        await request(app).post(`/api/message/send/${bob._id}`).set(auth(mallory.token))
            .send({messages: 'hi', senderId: alice._id});

        const saved = await Message.findOne({message: 'hi'});
        expect(saved.senderId.toString()).toBe(mallory._id);
    });

    test('no API response ever contains a password hash', async()=>{
        const alice = await registerUser(app, {fullname: 'Alice Search'});
        const bob = await registerUser(app);
        await request(app).post(`/api/message/send/${alice._id}`).set(auth(bob.token)).send({messages: 'yo'});

        const responses = await Promise.all([
            request(app).get('/api/user/search?search=alice').set(auth(bob.token)),
            request(app).get('/api/user/currentchatters').set(auth(bob.token)),
            request(app).get(`/api/message/${alice._id}`).set(auth(bob.token)),
        ]);
        for(const res of responses){
            expect(res.status).toBe(200);
            expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
        }
    });
});

describe('information disclosure', ()=>{
    test('error responses do not leak stack traces or internals', async()=>{
        const responses = await Promise.all([
            request(app).get('/api/does-not-exist'),
            request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json'),
            request(app).get('/api/message/not-an-id').set(auth('x')),
        ]);
        for(const res of responses){
            const body = JSON.stringify(res.body);
            expect(body).not.toMatch(/at .*\.js:\d+|node_modules|stack/i);
        }
    });
});
