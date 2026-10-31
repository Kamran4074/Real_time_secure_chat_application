import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app.js';
import User from '../models/userModel.js';
import { startDb, stopDb, clearDb, registerUser, auth } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const validUser = {
    fullname: 'Kamran Alam',
    username: 'kamran',
    email: 'Kamran@Test.com',
    gender: 'male',
    password: 'secret123'
};

describe('POST /api/auth/register', ()=>{
    test('creates a user and returns a token without the password', async()=>{
        const res = await request(app).post('/api/auth/register').send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.username).toBe('kamran');
        expect(res.body.email).toBe('kamran@test.com'); // stored lowercased
        expect(res.body).not.toHaveProperty('password');

        const saved = await User.findOne({username:'kamran'});
        expect(saved.password).not.toBe('secret123'); // hashed
    });

    test('sets an httpOnly secure cookie', async()=>{
        const res = await request(app).post('/api/auth/register').send(validUser);
        const cookie = res.headers['set-cookie'][0];
        expect(cookie).toMatch(/^jwt=/);
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/Secure/);
    });

    test('ignores a profilepic URL sent by the client', async()=>{
        const res = await request(app).post('/api/auth/register')
            .send({...validUser, profilepic:'https://evil.example/track.png'});
        expect(res.body.profilepic).not.toContain('evil.example');
    });

    test.each([
        ['missing fields', {username:'abc'}, /All fields are required/],
        ['invalid email', {...validUser, email:'not-an-email'}, /Invalid email/],
        ['short password', {...validUser, password:'123'}, /6-72/],
        ['bad username', {...validUser, username:'a b'}, /Username/],
        ['invalid gender', {...validUser, gender:'robot'}, /Invalid gender/],
        ['full name over 60 chars', {...validUser, fullname:'a'.repeat(61)}, /Full name/],
        ['password over 72 chars', {...validUser, password:'a'.repeat(73)}, /6-72/],
        ['non-string field (NoSQL injection)', {...validUser, email:{$ne:null}}, /All fields are required/],
    ])('rejects %s with 400', async(_, body, message)=>{
        const res = await request(app).post('/api/auth/register').send(body);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(message);
    });

    test('rejects a duplicate username (case-insensitive)', async()=>{
        await request(app).post('/api/auth/register').send(validUser);
        const res = await request(app).post('/api/auth/register')
            .send({...validUser, username:'KAMRAN', email:'other@test.com'});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Username already exists');
    });

    test('rejects a duplicate email (case-insensitive)', async()=>{
        await request(app).post('/api/auth/register').send(validUser);
        const res = await request(app).post('/api/auth/register')
            .send({...validUser, username:'someoneelse', email:'KAMRAN@TEST.COM'});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email already exists');
    });

    test('regex characters in username are matched literally', async()=>{
        await request(app).post('/api/auth/register').send(validUser);
        // "kamra." would match "kamran" if it were treated as a regex
        const res = await request(app).post('/api/auth/register')
            .send({...validUser, username:'kamra.', email:'other@test.com'});
        expect(res.status).toBe(201);
    });
});

describe('POST /api/auth/login', ()=>{
    beforeEach(async()=>{
        await request(app).post('/api/auth/register').send(validUser);
    });

    test('logs in with correct credentials (email case-insensitive)', async()=>{
        const res = await request(app).post('/api/auth/login')
            .send({email:'KAMRAN@test.com', password:'secret123'});
        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body).not.toHaveProperty('password');
    });

    test('wrong password and unknown email give the same message', async()=>{
        const wrongPass = await request(app).post('/api/auth/login')
            .send({email:'kamran@test.com', password:'wrongpass'});
        const unknown = await request(app).post('/api/auth/login')
            .send({email:'nobody@test.com', password:'secret123'});

        expect(wrongPass.status).toBe(400);
        expect(unknown.status).toBe(400);
        expect(wrongPass.body.message).toBe('Invalid email or password');
        expect(unknown.body.message).toBe(wrongPass.body.message);
    });

    test('a regex pattern as email does not match a real account', async()=>{
        const res = await request(app).post('/api/auth/login')
            .send({email:'.*', password:'secret123'});
        expect(res.status).toBe(400);
    });

    test('a ReDoS pattern returns quickly', async()=>{
        const start = Date.now();
        await request(app).post('/api/auth/login')
            .send({email:'(a+)+$' + 'a'.repeat(30) + '!', password:'x'});
        expect(Date.now() - start).toBeLessThan(2000);
    });

    test('rejects missing credentials', async()=>{
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
    });
});

describe('protected routes and token revocation', ()=>{
    test('no token -> 401', async()=>{
        const res = await request(app).get('/api/user/currentchatters');
        expect(res.status).toBe(401);
    });

    test('tampered token -> 401', async()=>{
        const {token} = await registerUser(app);
        const res = await request(app).get('/api/user/currentchatters').set(auth(token + 'x'));
        expect(res.status).toBe(401);
    });

    test('expired token -> 401', async()=>{
        const {_id} = await registerUser(app);
        const expired = jwt.sign({userId:_id}, process.env.JWT_SECRET, {expiresIn:-10, jwtid:'abc'});
        const res = await request(app).get('/api/user/currentchatters').set(auth(expired));
        expect(res.status).toBe(401);
    });

    test('old token without jti -> 401', async()=>{
        const {_id} = await registerUser(app);
        const old = jwt.sign({userId:_id}, process.env.JWT_SECRET, {expiresIn:'1d'});
        const res = await request(app).get('/api/user/currentchatters').set(auth(old));
        expect(res.status).toBe(401);
    });

    test('token of a deleted user -> 401', async()=>{
        const {_id, token} = await registerUser(app);
        await User.deleteOne({_id});
        const res = await request(app).get('/api/user/currentchatters').set(auth(token));
        expect(res.status).toBe(401);
    });

    test('logout revokes only that token', async()=>{
        const {token} = await registerUser(app, {email:'multi@test.com', password:'secret123'});
        // second device
        const login = await request(app).post('/api/auth/login')
            .send({email:'multi@test.com', password:'secret123'});
        const otherDevice = login.body.token;

        const out = await request(app).post('/api/auth/logout').set(auth(token));
        expect(out.status).toBe(200);
        expect(out.headers['set-cookie'][0]).toMatch(/jwt=;/); // cookie cleared

        const reused = await request(app).get('/api/user/currentchatters').set(auth(token));
        expect(reused.status).toBe(401);

        const stillIn = await request(app).get('/api/user/currentchatters').set(auth(otherDevice));
        expect(stillIn.status).toBe(200);
    });

    test('logout without a token -> 401', async()=>{
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(401);
    });
});
